const debug = require("debug")("dbus-victron-virtual");
const path = require("path");
const packageJson = require(path.join(__dirname, "../", "package.json"));

const products = {
  temperature: 0xc060,
  meteo: 0xc061,
  grid: 0xc062,
  tank: 0xc063,
  heatpump: 0xc064,
  battery: 0xc065,
  pvinverter: 0xc066,
  ev: 0xc067,
  gps: 0xc068,
  'switch': 0xc069
};

function getType(value) {
  return value === null
    ? "d"
    : typeof value === "undefined"
      ? (() => {
        throw new Error("Value cannot be undefined");
      })()
      : typeof value === "string"
        ? "s"
        : typeof value === "number"
          ? isNaN(value)
            ? (() => {
              throw new Error("NaN is not a valid input");
            })()
            : Number.isInteger(value)
              ? "i"
              : "d"
          : (() => {
            throw new Error("Unsupported type: " + typeof value);
          })();
}

function wrapValue(t, v) {
  if (v === null) {
    return ["ai", []];
  }
  switch (t) {
    case "b":
      return ["b", v];
    case "s":
      return ["s", v];
    case "i":
      return ["i", v];
    case "d":
      return ["d", v];
    default:
      return t.type ? wrapValue(t.type, v) : v;
  }
}

function unwrapValue([t, v]) {
  switch (t[0].type) {
    case "b":
      return !!v[0];
    case "s":
      return v[0];
    case "i":
      return Number(v[0]);
    case "d":
      return Number(v[0]);
    case "ai":
      if (v.length === 1 && v[0].length === 0) {
        return null;
      }
      throw new Error(
        'Unsupported value type "ai", only supported as empty array',
      );
    case "a":
      try {
        const valueType = t[0].child[0].type;
        if (v.length === 1 && v[0].length === 0 && valueType === 'i') {
          // represents a null value
          return null;
        }
      } catch (e) {
        console.error(e);
        throw new Error(
          'Unable to unwrap array value: ' + e
        )
      }
      throw new Error('array value, only empty i value supported, to represent null')
    default:
      throw new Error(`Unsupported value type: ${JSON.stringify(t)}`);
  }
}

/** validate and possibly convert a new number, received through SetValue or otherwise */
function validateNewNumber(name, declaration, value) {
  const number = Number(value);
  if (isNaN(number)) {
    throw new Error(`value for ${name} is not a number.`);
  }
  if (declaration.max !== undefined && number > declaration.max) {
    throw new Error(`value for ${name} is too large`);
  }
  if (declaration.min !== undefined && number < declaration.min) {
    throw new Error(`value for ${name} is too small`);
  }
  if (declaration.type === "i") {
    return Math.floor(number);
  } else {
    return number;
  }
}

/** validate and possibly convert a new value (received through SetValue or otherwise) */
function validateNewValue(name, declaration, value) {

  // we always allow a null value
  if (value === null) {
    return null;
  }

  try {
    switch (declaration.type) {
      case 'b':
        // we allow boolean values to be set as strings or numbers as well
        if (value === true || value == 'true' || value == '1') {
          return true
        } else if (value === false || value == 'false' || value == '0') {
          return false
        }
        throw new Error(`validation failed for ${name}, type ${declaration.type}, check logs for details.`)
      case 'i':
      case 'd':
        return validateNewNumber(name, declaration, value);
      case 's':
      default:
        // we treat any other type as a string as well
        return '' + value;
    }
  } catch (e) {
    console.warn(
      `validation failed for property ${name}, value:`, value
    )
    throw e
  }
}

async function addSettings(bus, settings) {
  const body = [
    settings.map((setting) => [
      ["path", wrapValue("s", setting.path)],
      [
        "default",
        wrapValue(
          typeof setting.type !== "undefined"
            ? setting.type
            : getType(setting.default),
          setting.default,
        ),
      ],
      ["min", wrapValue(setting.type || "d", setting.min !== undefined ? setting.min : null)],
      ["max", wrapValue(setting.type || "d", setting.max !== undefined ? setting.max : null)],
    ]),
  ];
  return await new Promise((resolve, reject) => {
    bus.invoke(
      {
        interface: "com.victronenergy.Settings",
        path: "/",
        member: "AddSettings",
        destination: "com.victronenergy.settings",
        type: undefined,
        signature: "aa{sv}",
        body: body,
      },
      function (err, result) {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      },
    );
  });
}

async function removeSettings(bus, settings) {
  const body = [settings.map((setting) => setting.path)];

  return new Promise((resolve, reject) => {
    bus.invoke(
      {
        interface: "com.victronenergy.Settings",
        path: "/",
        member: "RemoveSettings",
        destination: "com.victronenergy.settings",
        type: undefined,
        signature: "as",
        body: body,
      },
      function (err, result) {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      },
    );
  });
}

async function setValue(bus, { path, interface_, destination, value, type }) {
  return await new Promise((resolve, reject) => {
    if (path === "/DeviceInstance") {
      console.warn(
        "setValue called for path /DeviceInstance, this will be ignored by Victron services.",
      );
    }
    bus.invoke(
      {
        interface: interface_,
        path: path || "/",
        member: "SetValue",
        destination,
        signature: "v",
        body: [
          wrapValue(typeof type !== "undefined" ? type : getType(value), value),
        ],
      },
      function (err, result) {
        if (err) {
          return reject(err);
        }
        resolve(result);
      },
    );
  });
}

async function getValue(bus, { path, interface_, destination }) {
  return await new Promise((resolve, reject) => {
    bus.invoke(
      {
        interface: interface_,
        path: path || "/",
        member: "GetValue",
        destination,
      },
      function (err, result) {
        if (err) {
          return reject(err);
        }
        resolve(result);
      },
    );
  });
}

async function getMin(bus, { path, interface_, destination }) {
  return await new Promise((resolve, reject) => {
    bus.invoke(
      {
        interface: interface_,
        path: path || "/",
        member: "GetMin",
        destination,
      },
      function (err, result) {
        if (err) {
          return reject(err);
        }
        resolve(result);
      },
    );
  });
}

async function getMax(bus, { path, interface_, destination }) {
  return await new Promise((resolve, reject) => {
    bus.invoke(
      {
        interface: interface_,
        path: path || "/",
        member: "GetMax",
        destination,
      },
      function (err, result) {
        if (err) {
          return reject(err);
        }
        resolve(result);
      },
    );
  });
}

function addVictronInterfaces(
  bus,
  declaration,
  definition,
  add_defaults = true,
) {
  const warnings = [];

  if (!declaration.name) {
    throw new Error("Interface name is required");
  }

  if (!declaration.name.match(/^[a-zA-Z0-9_.]+$/)) {
    warnings.push(
      `Interface name contains problematic characters, only a-zA-Z0-9_ allowed.`,
    );
  }
  if (!declaration.name.match(/^com.victronenergy/)) {
    warnings.push("Interface name should start with com.victronenergy");
  }

  function addDefaults() {
    debug("addDefaults, declaration.name:", declaration.name);
    const productInName = declaration.name.split(".")[2];
    if (!productInName) {
      console.warn(
        `Unable to extract product from name, ensure name is of the form 'com.victronenergy.product.my_name', declaration.name=${declaration.name}`
      );
      return;
    }
    const product = products[productInName];
    if (!product) {
      const productNames = Object.keys(products);
      console.warn(
        `Invalid product ${productInName}, ensure product name is in ${productNames.join(", ")}`,
      );
      return;
    }
    declaration["properties"]["Mgmt/Connection"] = "s";
    definition["Mgmt/Connection"] = "Virtual";
    declaration["properties"]["Mgmt/ProcessName"] = "s";
    definition["Mgmt/ProcessName"] = packageJson.name;
    declaration["properties"]["Mgmt/ProcessVersion"] = "s";
    definition["Mgmt/ProcessVersion"] = packageJson.version;

    declaration["properties"]["ProductId"] = {
      type: "i",
      format: (/* v */) => product.toString(16),
    };
    definition["ProductId"] = products[declaration["name"].split(".")[2]];
    declaration["properties"]["ProductName"] = "s";
    definition["ProductName"] = `Virtual ${declaration["name"].split(".")[2]}`;
  }

  if (add_defaults == true) {
    addDefaults();
  }

  const getFormatFunction = (v) => {
    if (v.format && typeof v.format === "function") {
      // Wrap the custom format function to ensure it always returns a string
      return (value) => {
        const formatted = v.format(value);
        return formatted != null ? String(formatted) : "";
      };
    } else {
      return (value) => {
        if (value == null) return "";

        let stringValue = String(value);

        // Handle potential type mismatches
        switch (v.type) {
          case "d": // double/float
            return isNaN(parseFloat(stringValue)) ? "" : stringValue;
          case "i": // integer
            return isNaN(parseInt(stringValue, 10)) ? "" : stringValue;
          case "s": // string
            return stringValue;
          default:
            return stringValue;
        }
      };
    }
  };

  // we use this for GetItems and ItemsChanged. If 'items' is true, we prepend a slash to the key
  function getProperties(items = false) {
    return Object.entries(declaration.properties || {}).map(([k, v]) => {
      debug("getProperties, entries, (k,v):", k, v);

      const format = getFormatFunction(v);
      return [
        items ? k.replace(/^(?!\/)/, "/") : k,
        [
          ["Value", wrapValue(v, definition[k])],
          ["Text", ["s", format(definition[k])]],
        ],
      ];
    });
  }

  const iface = {
    GetItems: function () {
      return getProperties(true);
    },
    GetValue: function () {
      return Object.entries(declaration.properties || {}).map(([k, v]) => {
        debug("GetValue, definition[k] and v:", definition[k], v);
        return [k.replace(/^(?!\/)/, ""), wrapValue(v, definition[k])];
      });
    },
    emit: function () { },
  };

  const ifaceDesc = {
    name: "com.victronenergy.BusItem",
    methods: {
      GetItems: ["", "a{sa{sv}}", [], ["items"]],
      GetValue: ["", "a{sv}", [], ["value"]],
    },
    signals: {
      ItemsChanged: ["a{sa{sv}}", "", [], []],
    },
  };

  bus.exportInterface(iface, "/", ifaceDesc);

  // support GetValue, SetValue, GetMin, and GetMax for each property
  for (const [k] of Object.entries(declaration.properties || {})) {
    bus.exportInterface(
      {
        GetValue: function (/* value, msg */) {
          const v = (declaration.properties || {})[k];
          debug("GetValue, definition[k] and v:", definition[k], v);
          return wrapValue(v, definition[k]);
        },
        GetText: function () {
          const v = (declaration.properties || {})[k];
          const format = getFormatFunction(v);
          return format(definition[k]);
        },
        SetValue: function (value /* msg */) {
          console.log(
            "SetValue",
            JSON.stringify(arguments[0]),
            JSON.stringify(arguments[1]),
          );
          try {
            definition[k] = validateNewValue(k, declaration.properties[k], unwrapValue(value));
            iface.emit("ItemsChanged", getProperties(true));
            return 0;
          } catch (e) {
            console.error(e);
            return -1;
          }
        },
        GetMin: function () {
          const v = (declaration.properties || {})[k];
          // Ensure we return a wrapped null if min is undefined
          const minValue = (v && v.min !== undefined) ? v.min : null;
          return wrapValue(v.type || getType(minValue), minValue);
        },
        GetMax: function () {
          const v = (declaration.properties || {})[k];
          // Ensure we return a wrapped null if max is undefined
          const maxValue = (v && v.max !== undefined) ? v.max : null;
          return wrapValue(v.type || getType(maxValue), maxValue);
        },
      },
      `/${k}`,
      {
        name: "com.victronenergy.BusItem",
        methods: {
          GetValue: ["", "v", [], ["value"]],
          GetText: ["", "s", [], ["text"]],
          SetValue: ["v", "i", [], []],
          GetMin: ["", "v", [], ["min"]],
          GetMax: ["", "v", [], ["max"]],
        },
      },
    );
  }

  return {
    emitItemsChanged: () => iface.emit("ItemsChanged", getProperties()),
    addSettings: (settings) => addSettings(bus, settings),
    removeSettings: (settings) => removeSettings(bus, settings),
    setValue: ({ path, interface_, destination, value, type }) =>
      setValue(bus, { path, interface_, destination, value, type }),
    getValue: ({ path, interface_, destination }) =>
      getValue(bus, { path, interface_, destination }),
    getMin: ({ path, interface_, destination }) =>
      getMin(bus, { path, interface_, destination }),
    getMax: ({ path, interface_, destination }) =>
      getMax(bus, { path, interface_, destination }),
    warnings,
  };
}

module.exports = {
  addVictronInterfaces,
  addSettings,
  removeSettings,
  getValue,
  setValue,
  getMin,
  getMax,
  // we export private functions for unit-testing
  __private__: {
    validateNewValue
  }
};

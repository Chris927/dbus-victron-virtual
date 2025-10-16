const debug = require("debug")("dbus-victron-virtual");
const path = require("path");
const packageJson = require(path.join(__dirname, "../", "package.json"));

const products = {
  temperature: { id: 0xc060, name: 'temperature sensor' },
  meteo: { id: 0xc061 },
  grid: { id: 0xc062, name: 'grid meter' },
  tank: { id: 0xc063, name: 'tank sensor' },
  heatpump: { id: 0xc064 },
  battery: { id: 0xc065 },
  pvinverter: { id: 0xc066, name: 'PV inverter' },
  ev: { id: 0xc067, name: 'EV' },
  gps: { id: 0xc068, name: 'GPS' },
  'switch': { id: 0xc069 },
  acload: { id: 0xc06a, name: 'AC load' },
  genset: { id: 0xc06b },
  motordrive: { id: 0xc06c },
  dcgenset: { id: 0xc06d, name: 'DC genset' }
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
    case "as":
      if (!Array.isArray(v)) {
        throw new Error('value must be an array for type "as"');
      }
      for (const item of v) {
        if (typeof item !== "string") {
          throw new Error('all items in array must be strings for type "as"');
        }
      }
      return ["as", v];
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

  debug('validateNewValue called, name:', name, 'declaration:', declaration, 'value:', value);

  // we allow the declaration to be just a type ('s' or 'i'), or an object with a 'type'property, e.g. { type: 's' }.
  const type = declaration.type === undefined ? declaration : declaration.type;

  // we always allow a null value
  if (value === null) {
    return null;
  }

  try {
    switch (type) {
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
      case 'as':
        if (!Array.isArray(value)) {
          throw new Error(`value for ${name} must be an array`);
        }
        for (const item of value) {
          if (typeof item !== "string") {
            throw new Error(`all items in array for ${name} must be strings`);
          }
        }
        return value;
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
      function(err, result) {
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
      function(err, result) {
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
      function(err, result) {
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
      function(err, result) {
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
      function(err, result) {
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
      function(err, result) {
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
  emitCallback = null
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

  debug(`addVictronInterfaces:`, declaration, definition, add_defaults);

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
    definition["Mgmt/Connection"] = "Node-RED";
    declaration["properties"]["Mgmt/ProcessName"] = "s";
    definition["Mgmt/ProcessName"] = packageJson.name;
    declaration["properties"]["Mgmt/ProcessVersion"] = "s";
    definition["Mgmt/ProcessVersion"] = packageJson.version;

    declaration["properties"]["ProductId"] = {
      type: "i",
      format: (/* v */) => product['id'].toString(16),
    };
    definition["ProductId"] = products[declaration["name"].split(".")[2]]['id'];
    declaration["properties"]["ProductName"] = "s";
    definition["ProductName"] = 'Virtual ' + (product.name ? product.name : declaration["name"].split(".")[2]);
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

  // we use this for GetItems and ItemsChanged.
  function getProperties(limitToPropertyNames = [], prependSlash = false) {
    // Filter entries based on specificItem if provided
    const entries = Object.entries(declaration.properties || {});
    const filteredEntries = (limitToPropertyNames || []).length > 0
      ? entries.filter(([k,]) => limitToPropertyNames.includes(k))
      : entries;

    return filteredEntries.map(([k, v]) => {
      debug("getProperties, entries, (k,v):", k, v);

      const format = getFormatFunction(v);
      return [
        // Add leading slash only if we're filtering for a specific item
        prependSlash ? k.replace(/^(?!\/)/, "/") : k,
        [
          ["Value", wrapValue(v, definition[k])],
          ["Text", ["s", format(definition[k])]],
        ],
      ];
    });
  }

  const iface = {
    GetItems: function() {
      return getProperties(null, true);
    },
    GetValue: function() {
      return Object.entries(declaration.properties || {}).map(([k, v]) => {
        debug("GetValue, definition[k] and v:", definition[k], v);
        return [k.replace(/^(?!\/)/, ""), wrapValue(v, definition[k])];
      });
    },
    SetValues: function(values /* msg */) {
      debug(`SetValues called with values:`, values);
      for (const [k, value] of values) {
        if (!declaration.properties || !declaration.properties[k]) {
          throw new Error(`Property ${k} not found in properties.`);
        }
        definition[k] = validateNewValue(k, declaration.properties[k], unwrapValue(value));
      }
      debug(`SetValues updated definition:`, definition);
      // TODO: we must include changed values only.
      iface.emit("ItemsChanged", getProperties(Object.keys(values), true));
      return 0;
    },
    emit: function(name, args) {
      debug("emit called, name:", name, "args:", args);
      if (emitCallback) {
        emitCallback(name, args);
      }
    },
  };

  function setValuesLocally(values) {

    debug(`setValuesLocally called with values:`, values);

    if (Object.keys(values).length === 0) {
      throw new Error("No values provided to setValuesLocally.");
    }

    const sanitizedValues = {};
    for (const [key, value] of Object.entries(values)) {
      const cleanKey = key.startsWith('/') ? key.substring(1) : key;
      sanitizedValues[cleanKey] = value;
    }

    for (const k of Object.keys(sanitizedValues)) {
      if (!declaration.properties || !declaration.properties[k]) {
        throw new Error(`Property ${k} not found in properties.`);
      }
      definition[k] = validateNewValue(k, declaration.properties[k], sanitizedValues[k]);
    }
    debug(`setValuesLocally updated definition:`, definition);
    iface.emit("ItemsChanged", getProperties(Object.keys(sanitizedValues), true));
  }

  const ifaceDesc = {
    name: "com.victronenergy.BusItem",
    methods: {
      GetItems: ["", "a{sa{sv}}", [], ["items"]],
      GetValue: ["", "a{sv}", [], ["value"]],
      SetValues: ["a{sv}", "i", [], []],
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
        GetValue: function(/* value, msg */) {
          const v = (declaration.properties || {})[k];
          debug("GetValue, definition[k] and v:", definition[k], v);
          return wrapValue(v, definition[k]);
        },
        GetText: function() {
          const v = (declaration.properties || {})[k];
          const format = getFormatFunction(v);
          return format(definition[k]);
        },
        SetValue: function(value /* msg */) {
          try {
            definition[k] = validateNewValue(k, declaration.properties[k], unwrapValue(value));
            iface.emit("ItemsChanged", getProperties([k], true));
            return 0;
          } catch (e) {
            console.error(e);
            return -1;
          }
        },
        GetMin: function() {
          const v = (declaration.properties || {})[k];
          // Ensure we return a wrapped null if min is undefined
          const minValue = (v && v.min !== undefined) ? v.min : null;
          return wrapValue(v.type || getType(minValue), minValue);
        },
        GetMax: function() {
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
    setValuesLocally,
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
    validateNewValue,
    wrapValue,
  }
};

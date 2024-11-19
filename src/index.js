const debug = require("debug")("dbus-victron-virtual");
const { createConnection } = require("dbus-native-victron");
const path = require("path");
const packageJson = require(path.join(__dirname, "../", "package.json"));

const products = {
  temperature: 0xc060,
  meteo: 0xc061,
  grid: 0xc062,
  tank: 0xc063
};

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
      throw new Error(`Unable to extract product from name, ensure name is of the form 'com.victronenergy.product.my_name', declaration.name=${declaration.name}`);
    }
    const product = products[productInName];
    if (!product) {
      throw new Error(`Invalid product, ensure product name is in ${products.join(", ")}`);
    }
    declaration["properties"]["Mgmt/Connection"] = "s";
    definition["Mgmt/Connection"] = "Virtual";
    declaration["properties"]["Mgmt/ProcessName"] = "s";
    definition["Mgmt/ProcessName"] = packageJson.name;
    declaration["properties"]["Mgmt/ProcessVersion"] = "s";
    definition["Mgmt/ProcessVersion"] = packageJson.version;

    declaration["properties"]["ProductId"] = {
      type: "i",
      format: (/* v */) =>
        product.toString(16),
    };
    definition["ProductId"] = products[declaration["name"].split(".")[2]];
    declaration["properties"]["ProductName"] = "s";
    definition["ProductName"] = `Virtual ${declaration["name"].split(".")[2]}`;
  }

  if (add_defaults == true) {
    addDefaults();
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
        if (v[0].length === 0) {
          return null;
        }
        throw new Error(
          'Unsupported value type "ai", only supported as empty array',
        );
      default:
        throw new Error(`Unsupported value type: ${JSON.stringify(t)}`);
    }
  }

  const getFormatFunction = (v) => {
    if (v.format && typeof v.format === 'function') {
      // Wrap the custom format function to ensure it always returns a string
      return (value) => {
        const formatted = v.format(value);
        return formatted != null ? String(formatted) : '';
      };
    } else {
      return (value) => {
        if (value == null) return '';

        let stringValue = String(value);

        // Handle potential type mismatches
        switch (v.type) {
          case 'd': // double/float
            return isNaN(parseFloat(stringValue)) ? '' : stringValue;
          case 'i': // integer
            return isNaN(parseInt(stringValue, 10)) ? '' : stringValue;
          case 's': // string
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

  function getType(value) {
    return value === null ? 'd'
        : typeof value === 'undefined' ? (() => { throw new Error('Value cannot be undefined'); })()
        : typeof value === 'string' ? 's'
        : typeof value === 'number'
            ? (isNaN(value)
                ? (() => { throw new Error('NaN is not a valid input'); })()
                : Number.isInteger(value) ? 'i' : 'd')
        : (() => { throw new Error('Unsupported type: ' + typeof value); })();
  }

  const iface = {
    GetItems: function () {
      return getProperties(true);
    },
    GetValue: function () {
      return Object.entries(declaration.properties || {}).map(([k, v]) => {
        debug("GetValue, definition[k] and v:", definition[k], v);
        return [k.replace(/^(?!\/)/, "/"), wrapValue(v, definition[k])];
      });
    },
    emit: function () {},
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

  // support GetValue and SetValue for each property
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
          debug(
            "SetValue",
            JSON.stringify(arguments[0]),
            JSON.stringify(arguments[1]),
          );
          try {
            definition[k] = unwrapValue(value);
            iface.emit("ItemsChanged", getProperties(true));
            return 0;
          } catch (e) {
            console.error(e);
            return -1;
          }
        },
      },
      `/${k}`,
      {
        name: "com.victronenergy.BusItem",
        methods: {
          GetValue: ["", "v", [], ["value"]],
          GetText: ["", "s", [], ["text"]],
          SetValue: ["v", "i", [], []],
        },
      },
    );
  }

  async function addSettings(settings) {
    const body = [
      settings.map((setting) => [
        ["path", wrapValue("s", setting.path)],
        ["default", wrapValue(typeof setting.type !== 'undefined' ? setting.type: getType(setting.default), setting.default)],
        // TODO: incomplete, min and max missing
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

  async function removeSettings(settings) {
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

  async function setValue({ path, interface_, destination, value, type }) {
    return await new Promise((resolve, reject) => {
      if (path === '/DeviceInstance') {
        // when the device instance changes, we need to re-connect
        definition.DeviceInstance = value;
        bus.connection.end();
        bus.connection = createConnection();
        resolve();
      } else {
        bus.invoke(
          {
            interface: interface_,
            path: path || "/",
            member: "SetValue",
            destination,
            signature: "v",
            body: [wrapValue(typeof type !== 'undefined' ? type: getType(value), value)],
          },
          function (err, result) {
            if (err) {
              return reject(err);
            }
            resolve(result);
          },
        );
      }
    });
  }

  async function getValue({ path, interface_, destination }) {
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

  return {
    emitItemsChanged: () => iface.emit("ItemsChanged", getProperties()),
    addSettings,
    removeSettings,
    setValue,
    getValue,
    warnings,
  };
}

module.exports = { addVictronInterfaces };

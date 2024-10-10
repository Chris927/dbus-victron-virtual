const debug = require("debug")("dbus-victron-virtual");
const path = require("path");
const packageJson = require(path.join(__dirname, "../", "package.json"));

const products = {
  temperature: 0xc060,
  meteo: 0xc061,
  grid: 0xc062,
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
    console.log("addDefaults, declaration.name:", declaration.name);
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

  // we use this for GetItems and ItemsChanged. If 'items' is true, we prepend a slash to the key
  function getProperties(items = false) {
    return Object.entries(declaration.properties || {}).map(([k, v]) => {
      debug("getProperties, entries, (k,v):", k, v);

      const format = v.type && v.format ? v.format : (v) => "" + v;
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
          if (definition[k] === null) {
            return ["ai", []]; // by convention, this represents a null / empty value
          }
          return wrapValue(v, definition[k]);
        },
        GetText: function () {
          const v = (declaration.properties || {})[k];
          const format = v.type && v.format ? v.format : (v) => "" + v;
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
            iface.emit("ItemsChanged", getProperties());
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
        ["default", wrapValue("s", "" + setting.default)], // TODO: forcing value to be string
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

  async function setValue({ path, interface_, destination, value }) {
    return await new Promise((resolve, reject) => {
      bus.invoke(
        {
          interface: interface_,
          path: path || "/",
          member: "SetValue",
          destination,
          signature: "v",
          body: [wrapValue("s", "" + value)], // TODO: only supports string type for now
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

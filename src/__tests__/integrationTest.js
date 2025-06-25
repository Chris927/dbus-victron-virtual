const dbus = require("dbus-native-victron");
const { addVictronInterfaces } = require("../index");

const describeIf = (condition, ...args) =>
  condition ? describe(...args) : describe.skip(...args);

function createIntegrationTestDbusClient() {
  const bus = process.env.DBUS_ADDRESS ? dbus.createClient({
    busAddress: process.env.DBUS_ADDRESS,
    authMethods: ["ANONYMOUS"],
  }) : dbus.sessionBus();
  return bus;
}

async function requestServiceName(bus, serviceName) {
  return await new Promise((resolve, reject) => {
    bus.requestName(serviceName, 0x4, (err, retCode) => {
      if (err) {
        return reject(
          new Error(
            `Could not request service name ${serviceName}, the error was: ${err}.`,
          ),
        );
      }

      if (retCode === 1) {
        console.log(`Successfully requested service name "${serviceName}"`);
        resolve();
      } else {
        return reject(
          new Error(
            `Failed to request service name "${serviceName}". Check what return code "${retCode}" means.`,
          ),
        );
      }
    });
  });
}

describeIf(process.env.TEST_INTEGRATION, "run integration tests", () => {

  test("call SetValue from a dbus client on our victron interface", async () => {

    const serviceBus = createIntegrationTestDbusClient();
    const clientBus = createIntegrationTestDbusClient();

    const serviceName = "com.victronenergy.temperature.integration_test_set_value";

    // TODO: the service name with '/' instead of '.' seems to be used for emitting signals only, it might be unnecessary
    const objectPath = `/${serviceName.replace(/\./g, "/")}`;

    var ifaceDesc = {
      name: serviceName,
      properties: {
        Flag1: "b",
        StringProp1: "s",
        IntValue: "i",
      },
    };

    const iface = {
      Flag1: true,
      StringProp1: "initial string",
      IntValue: 42,
      emit: function() { },
    }

    await requestServiceName(serviceBus, serviceName);

    serviceBus.exportInterface(iface, objectPath, ifaceDesc);

    addVictronInterfaces(serviceBus, ifaceDesc, iface);

    // call setValue from a client
    await new Promise((resolve, reject) => {
      clientBus.invoke({
        path: '/StringProp1',
        destination: serviceName,
        interface: 'com.victronenergy.BusItem',
        member: 'SetValue',
        signature: 'v',
        body: [['s', 'new value from client']],
      }, (err) => {
        if (err) {
          return reject(new Error(`Failed to call SetValue: ${err}`));
        }
        return resolve();
      })
    });

    expect(iface.StringProp1).toEqual("new value from client");

    // call setValues from a client
    await new Promise((resolve, reject) => {
      clientBus.invoke({
        path: '/',
        destination: serviceName,
        interface: 'com.victronenergy.BusItem',
        member: 'SetValues',
        signature: 'a{sv}',
        body: [[
          ["/StringProp1", ["s", "new value from SetValues"]],
          ["/IntValue", ["i", 43]],
        ]],
      }, (err) => {
        if (err) {
          return reject(new Error(`Failed to call SetValues: ${err}`));
        }
        return resolve();
      })
    });

    expect(iface.StringProp1).toEqual("new value from SetValues");
    expect(iface.IntValue).toEqual(43);

    await new Promise((res) => setTimeout(res, 2_000));

    // end connections
    serviceBus.connection.end();
    clientBus.connection.end();

    // wait a bit more, until all logs are written
    await new Promise((res) => setTimeout(res, 4_000));

  }, 20_000);

  test("this is a dummy integration test", async () => {
    // example adopted from https://github.com/sidorares/dbus-native/blob/master/examples/basic-service.js
    const serviceName =
      "com.victronenergy.temperature.my_integration_test_service1";
    const interfaceName = serviceName;
    const objectPath = `/${serviceName.replace(/\./g, "/")}`;

    const bus = process.env.DBUS_ADDRESS ? dbus.createClient({
      busAddress: process.env.DBUS_ADDRESS,
      authMethods: ["ANONYMOUS"],
    }) : dbus.sessionBus();

    if (!bus) {
      throw new Error("Could not connect to the DBus session bus.");
    }

    // request service name from the bus
    await requestServiceName(bus, serviceName);

    // First, we need to create our interface description (here we will only expose method calls)
    var ifaceDesc = {
      name: interfaceName,
      methods: {
        // Simple types
        SayHello: ["", "s", [], ["hello_sentence"]],
        GiveTime: ["", "s", [], ["current_time"]],
        Capitalize: ["s", "s", ["initial_string"], ["capitalized_string"]],
      },
      properties: {
        Flag: "b",
        StringProp: "s",
        RandValue: "i",
      },
      signals: {
        Rand: ["i", "random_number"],
      },
    };

    // Then we need to create the interface implementation (with actual functions)
    var iface = {
      SayHello: function() {
        return "Hello, world!";
      },
      GiveTime: function() {
        return new Date().toString();
      },
      Capitalize: function(str) {
        return str.toUpperCase();
      },
      Flag: true,
      StringProp: "initial string",
      RandValue: 43,
      emit: function() {
        // no nothing, as usual
      },
    };

    // Now we need to actually export our interface on our object
    bus.exportInterface(iface, objectPath, ifaceDesc);

    // Then we can add the required Victron interfaces, and receive some funtions to use
    const {
      emitItemsChanged,
      addSettings,
      removeSettings,
      getValue,
      setValue,
    } = addVictronInterfaces(bus, ifaceDesc, iface);

    console.log("Interface exposed to DBus, ready to receive function calls!");

    async function proceed() {
      const settingsResult = await addSettings([
        { path: "/Settings/Basic2/OptionA", default: 3, min: 0, max: 5 },
        { path: "/Settings/Basic2/OptionB", default: "x" },
        { path: "/Settings/Basic2/OptionC", default: "y" },
        { path: "/Settings/Basic2/OptionD", default: "y" },
      ]);
      console.log("settingsResult", JSON.stringify(settingsResult, null, 2));

      const interval = setInterval(async () => {
        // emit a random value (not relevant for our Victron interfaces)
        var rand = Math.round(Math.random() * 100);
        if (rand > 75) {
          iface.emit("Rand", Math.round(Math.random() * 100));
        }

        // set a random value. By calling emitItemsChanged afterwards, the
        // Victron-specific signal 'ItemsChanged' will be emitted
        iface.RandValue = Math.round(Math.random() * 100);
        emitItemsChanged();

        // change a setting programmatically
        const setValueResult = await setValue({
          path: "/Settings/Basic2/OptionB",
          value: "changed via SetValue " + Math.round(Math.random() * 100),
          interface: "com.victronenergy.BusItem",
          destination: "com.victronenergy.settings",
        });
        console.log("setValueResult", setValueResult);

        // or get a configuration value
        getValue({
          path: "/Settings/Basic2/OptionB",
          interface: "com.victronenergy.BusItem",
          destination: "com.victronenergy.settings",
        });
      }, 1_000);

      await new Promise((resolve) => {
        setTimeout(() => {
          console.log("CLEARING INTERVAL", interval);
          clearInterval(interval);
          removeSettings([
            { path: "/Settings/Basic2/OptionC", default: "y" },
            { path: "/Settings/Basic2/OptionD", default: "y" },
          ]);
          resolve();
        }, 5000);
      });
    }

    await proceed();
    bus.connection.end();

    // wait a bit more, until all logs are written
    await new Promise((res) => setTimeout(res, 2_000));
  }, /* timeout in milliseconds */ 20_000);
});

/* eslint-env node */
const { addVictronInterfaces } = require("../index");

describe("victron-dbus-virtual, s2 tests", () => {
  const noopBus = { exportInterface: () => { } };

  it("throws when handlers are missing", () => {
    const declaration = {
      name: "foo",
      __enableS2: true,
      __s2Handlers: {}
    }
    const definition = {};

    const handlerNames = [
      'Connect', 'Disconnect', 'Message', 'KeepAlive',
    ];

    for (const handlerName of handlerNames) {
      const message = `S2 support enabled, but no __s2Handlers.${handlerName} function provided in declaration`;
      expect(() => {
        addVictronInterfaces(
          noopBus,
          declaration,
          definition,
          false,
        );
      }).toThrow(message);
      declaration.__s2Handlers[handlerName] = () => { };
    }

  });

});


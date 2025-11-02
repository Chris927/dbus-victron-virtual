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

  describe('Connect method', () => {
    it('maintains the connection state', () => {
      const bus = {
        exportInterface: jest.fn(),
      }
      const declaration = {
        name: "foo",
        __enableS2: true,
        __s2Handlers: {
          Connect: () => { },
          Disconnect: () => { },
          Message: () => { },
          KeepAlive: () => { },
        }
      };
      const definition = {};
      addVictronInterfaces(
        bus,
        declaration,
        definition,
        false,
      );

      console.log('bus.exportInterface.mock.calls:', bus.exportInterface.mock.calls);

      const s2Interface = bus.exportInterface.mock.calls[1][0];
      const s2Declaration = bus.exportInterface.mock.calls[1][2];

      expect(s2Declaration).toBeDefined();
      expect(s2Declaration.name).toBe('com.victronenergy.S2');

      // TODO: the state is kept in the declaration, maybe keep it in the interface instead?
      expect(declaration.__s2state.connectedCemId).toBeNull();

      // Call Connect
      s2Interface.Connect('cem1234');
      expect(declaration.__s2state.connectedCemId).toBe('cem1234');

    });
  });


});


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

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('validates inputs', () => {
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

      const s2Interface = bus.exportInterface.mock.calls[1][0];
      const s2Declaration = bus.exportInterface.mock.calls[1][2];

      expect(s2Declaration).toBeDefined();
      expect(s2Declaration.name).toBe('com.victronenergy.S2');

      // Call Connect with invalid cemId
      const invalidCemIds = [1234, '', null];
      for (const invalidCemId of invalidCemIds) {
        expect(() => {
          s2Interface.Connect(invalidCemId, 30);
        }).toThrow('Invalid cemId provided to S2 Connect');
      }

      // Call Connect with invalid keepAliveInterval
      const invalidKeepAliveIntervals = [-10, 0, 'bla', null];
      for (const invalidKeepAliveInterval of invalidKeepAliveIntervals) {
        expect(() => {
          s2Interface.Connect('cem1234', invalidKeepAliveInterval);
        }).toThrow('Invalid keepAliveInterval provided to S2 Connect');
      }

    });

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

      const s2Interface = bus.exportInterface.mock.calls[1][0];
      const s2Declaration = bus.exportInterface.mock.calls[1][2];

      expect(s2Declaration).toBeDefined();
      expect(s2Declaration.name).toBe('com.victronenergy.S2');

      // TODO: the state is kept in the declaration, maybe keep it in the interface instead?
      expect(declaration.__s2state.connectedCemId).toBeNull();

      // Call Connect
      const keepAliveInterval = 15;
      const returnValue_initialConnect = s2Interface.Connect('cem1234', keepAliveInterval);
      expect(returnValue_initialConnect).toBe(true);
      expect(declaration.__s2state.connectedCemId).toBe('cem1234');

      // Call Connect again with same cemId
      const returnValue_secondConnect = s2Interface.Connect('cem1234', keepAliveInterval);
      expect(returnValue_secondConnect).toBe(true);
      expect(declaration.__s2state.connectedCemId).toBe('cem1234');

      // Call Connect with different cemId
      const returnValue_differentConnect = s2Interface.Connect('cem5678', keepAliveInterval);
      expect(returnValue_differentConnect).toBe(false);
      expect(declaration.__s2state.connectedCemId).toBe('cem1234');

      jest.advanceTimersByTime((keepAliveInterval * 1.3) * 1000); // advance time by keepAliveInterval + 30%

      // After keepAliveInterval + 30%, the connection should be considered lost
      expect(declaration.__s2state.connectedCemId).toBeNull();


    });

  });

});


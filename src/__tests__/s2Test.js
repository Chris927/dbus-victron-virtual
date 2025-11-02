/* eslint-env node */
const { addVictronInterfaces } = require("../index");

describe("victron-dbus-virtual, s2 tests", () => {

  const noopBus = {
    exportInterface: (bus) => {
      // TODO: trying to imitate dbus-native's monkey-patching of emit, but it's not working as intended
      if (typeof bus.emit === 'function') {
        const oldEmit = bus.emit;
        bus.emit = function() {
          const args = Array.from(arguments);
          oldEmit.apply(bus, args);
        }
      }
    }
  };

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
        exportInterface: jest.fn(noopBus.exportInterface),
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
        exportInterface: jest.fn(noopBus.exportInterface),
      }
      const emitCallback = jest.fn();
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
        emitCallback
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
      expect(emitCallback.mock.calls.length).toBe(1); // we had an earlier disconnect

      // TODO: we *should* receive the reason as third parameter, but currently don't, likely due to our monkey-patching of emit,
      // compare https://github.com/Chris927/dbus-native/blob/0b04da3f37d30b12d45bc8ccc1a5687c94355892/lib/bus.js#L231
      expect(emitCallback.mock.calls[0]).toEqual(['Disconnect', 'cem1234' /* , 'KeepAlive missed' */]);

      // connect again
      const returnValue_reconnect = s2Interface.Connect('cem1234', keepAliveInterval);
      expect(returnValue_reconnect).toBe(true);
      expect(declaration.__s2state.connectedCemId).toBe('cem1234');

      jest.advanceTimersByTime((keepAliveInterval * 1.1) * 1000); // advance time
      // ... then call keepalive
      s2Interface.KeepAlive('cem1234');
      // and advance time again
      jest.advanceTimersByTime((keepAliveInterval * 1.1) * 1000); // advance time
      expect(declaration.__s2state.connectedCemId).toBe('cem1234');

      // in case of a keepalive from a different cemId, respond with a disconnect signal
      s2Interface.KeepAlive('cem5678');
      expect(declaration.__s2state.connectedCemId).toBe('cem1234');
      expect(emitCallback.mock.calls.length).toBe(2);
      // TODO: we *should* receive the reason as third parameter, but currently don't, see TODO above
      expect(emitCallback.mock.calls[1]).toEqual(['Disconnect', 'cem5678' /* , 'Not connected' */]);

    });

  });

});


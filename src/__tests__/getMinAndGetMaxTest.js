const { addVictronInterfaces } = require("../index");

describe("GetMin and GetMax Tests", () => {
  let bus;
  
  beforeEach(() => {
    bus = {
      exportInterface: jest.fn(),
      invoke: jest.fn()
    };
  });

  it("should return min value when defined", () => {
    const declaration = {
      name: "com.victronenergy.test",
      properties: {
        Voltage: {
          type: "d",
          min: 0
        }
      }
    };
    const definition = { Voltage: 12.6 };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    const voltageInterface = calls.find(call => call[1] === "/Voltage")[0];
    
    expect(voltageInterface.GetMin()).toEqual(["d", 0]);
  });

  it("should return max value when defined", () => {
    const declaration = {
      name: "com.victronenergy.test",
      properties: {
        Voltage: {
          type: "d",
          max: 48
        }
      }
    };
    const definition = { Voltage: 12.6 };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    const voltageInterface = calls.find(call => call[1] === "/Voltage")[0];
    
    expect(voltageInterface.GetMax()).toEqual(["d", 48]);
  });

  it("should return null array when min is not defined", () => {
    const declaration = {
      name: "com.victronenergy.test",
      properties: {
        Voltage: {
          type: "d"
        }
      }
    };
    const definition = { Voltage: 12.6 };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    const voltageInterface = calls.find(call => call[1] === "/Voltage")[0];
    
    expect(voltageInterface.GetMin()).toEqual(["ai", []]);
  });

  it("should return null array when max is not defined", () => {
    const declaration = {
      name: "com.victronenergy.test",
      properties: {
        Voltage: {
          type: "d"
        }
      }
    };
    const definition = { Voltage: 12.6 };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    const voltageInterface = calls.find(call => call[1] === "/Voltage")[0];
    
    expect(voltageInterface.GetMax()).toEqual(["ai", []]);
  });

  it("should handle integer min and max values", () => {
    const declaration = {
      name: "com.victronenergy.test",
      properties: {
        Level: {
          type: "i",
          min: 0,
          max: 100
        }
      }
    };
    const definition = { Level: 50 };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    const levelInterface = calls.find(call => call[1] === "/Level")[0];
    
    expect(levelInterface.GetMin()).toEqual(["i", 0]);
    expect(levelInterface.GetMax()).toEqual(["i", 100]);
  });

  it("should handle float min and max values", () => {
    const declaration = {
      name: "com.victronenergy.test",
      properties: {
        Temperature: {
          type: "d",
          min: -20.5,
          max: 50.5
        }
      }
    };
    const definition = { Temperature: 25.0 };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    const tempInterface = calls.find(call => call[1] === "/Temperature")[0];
    
    expect(tempInterface.GetMin()).toEqual(["d", -20.5]);
    expect(tempInterface.GetMax()).toEqual(["d", 50.5]);
  });
});

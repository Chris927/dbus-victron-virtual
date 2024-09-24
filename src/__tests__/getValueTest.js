const { addVictronInterfaces } = require("../index");

describe("victron-dbus-virtual, GetValue being called on us", () => {
  it("works for the happy case", () => {
    const declaration = { name: "foo", properties: { IntProp: "i" } };
    const definition = { IntProp: 42 };
    const bus = {
      exportInterface: jest.fn(),
    };

    addVictronInterfaces(bus, declaration, definition, addDefaults = false);

    expect(bus.exportInterface.mock.calls.length).toBe(2);
    expect(bus.exportInterface.mock.calls[1][0].GetValue).toBeDefined();
    expect(bus.exportInterface.mock.calls[1][1]).toBe("/IntProp");

    const result = bus.exportInterface.mock.calls[1][0].GetValue();
    expect(result).toEqual(["i", 42]);
  });
});

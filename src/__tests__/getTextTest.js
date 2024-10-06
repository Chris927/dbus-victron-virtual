const { addVictronInterfaces } = require("../index");

describe("victron-dbus-virtual, GetText being called on us", () => {
  it("works for the happy case", () => {
    const declaration = { name: "foo", properties: { IntProp: "i" } };
    const definition = { IntProp: 42 };
    const bus = {
      exportInterface: jest.fn(),
    };

    addVictronInterfaces(bus, declaration, definition, false);

    expect(bus.exportInterface.mock.calls.length).toBe(2);
    expect(bus.exportInterface.mock.calls[1][0].GetText).toBeDefined();
    expect(bus.exportInterface.mock.calls[1][1]).toBe("/IntProp");

    const result = bus.exportInterface.mock.calls[1][0].GetText();
    expect(result).toEqual("42");
  });
  it("works with our format, if we specify one", () => {
    const declaration = {
      name: "foo",
      properties: {
        IntProp: {
          type: "i",
          format: (v) => (v === 42 ? "fourty-two" : "not fourty-two"),
        },
      },
    };
    const definition = { IntProp: 42 };
    const bus = {
      exportInterface: jest.fn(),
    };

    addVictronInterfaces(bus, declaration, definition, false);

    expect(bus.exportInterface.mock.calls.length).toBe(2);
    expect(bus.exportInterface.mock.calls[1][0].GetText).toBeDefined();
    expect(bus.exportInterface.mock.calls[1][1]).toBe("/IntProp");

    const result = bus.exportInterface.mock.calls[1][0].GetText();
    expect(result).toEqual("fourty-two");
  });
});

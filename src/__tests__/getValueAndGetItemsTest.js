const { addVictronInterfaces } = require("../index");

describe("victron-dbus-virtual, GetValue and GetItems being called on us", () => {
  it("works for the happy case", () => {
    const declaration = { name: "foo", properties: { IntProp: "i" } };
    const definition = { IntProp: 42 };
    const bus = {
      exportInterface: jest.fn(),
    };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[1][0].GetValue).toBeDefined();
    expect(calls[1][1]).toBe("/IntProp");

    // GetItems on path / returns the item with value and text
    const rootItemsResult = calls[0][0].GetItems();
    expect(rootItemsResult).toEqual([
      [
        "/IntProp",
        [
          ["Value", ["i", 42]],
          ["Text", ["s", "42"]],
        ],
      ],
    ]);

    // GetValue on path / returns all props (therefore nested array)
    // but without the leading slash
    const rootValueResult = calls[0][0].GetValue();
    expect(rootValueResult).toEqual([["IntProp", ["i", 42]]]);

    // GetValue on path /IntProp returns the value as a variant
    const valueResult = calls[1][0].GetValue();
    expect(valueResult).toEqual(["i", 42]);
  });
});

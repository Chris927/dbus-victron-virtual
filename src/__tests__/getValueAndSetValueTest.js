const { addVictronInterfaces } = require("../index");

describe("GetValue and SetValue called on us", () => {
  it("returns the value if not null, returns empty int variant array in case of null", () => {
    const declaration = { name: "foo", properties: { SomeProp: "s" } };
    const definition = { SomeProp: "some text" };
    const bus = {
      exportInterface: jest.fn(),
    };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[1][0].GetValue).toBeDefined();
    expect(calls[1][1]).toBe("/SomeProp");

    // GetValue on path /SomeProp returns the value as a variant
    const valueResult = calls[1][0].GetValue();
    expect(valueResult).toEqual(["s", "some text"]);

    definition.SomeProp = null;
    const valueResultNull = calls[1][0].GetValue();
    expect(valueResultNull).toEqual(["ai", []]);
  });
  it("sets the value given on SetValue, and sets the value to null when empty int array given", () => {
    const declaration = { name: "foo", properties: { SomeProp: "s" } };
    const definition = { SomeProp: "some text" };
    const bus = {
      exportInterface: jest.fn(),
    };

    addVictronInterfaces(bus, declaration, definition, false);

    const calls = bus.exportInterface.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[1][0].SetValue).toBeDefined();
    expect(calls[1][1]).toBe("/SomeProp");

    // SetValue on path /SomeProp sets the value on us
    const result = calls[1][0].SetValue([[{ type: "s" }], ["new text"]]);
    expect(definition.SomeProp).toEqual("new text");
    expect(result).toBe(0);

    // SetValue on path /SomeProp with an empty int array sets the value on us to null
    // TODO
    const nullResult = calls[1][0].SetValue([[{ type: "ai" }], [[]]]);
    expect(definition.SomeProp).toEqual(null);
    expect(nullResult).toBe(0);
  });
});

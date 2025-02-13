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
    // TODO:: we support "ai" and {type:"a", child: [{ type"i" }]} for null values. Do we need the former?
    // first approach of setting value to null
    const nullResult = calls[1][0].SetValue([[{ type: "ai" }], [[]]]);
    expect(definition.SomeProp).toEqual(null);
    expect(nullResult).toBe(0);
    // second approach of setting value to null
    const null2Result = calls[1][0].SetValue([
      [{ type: "a", child: [{ type: "i" }] }],
      [[]],
    ]);
    expect(definition.SomeProp).toEqual(null);
    expect(null2Result).toBe(0);

    // fails when having invalid data (and a non-empty int array is considered invalid)
    expect(calls[1][0].SetValue([[{ type: "a", child: [] }], [[]]])).toBe(-1); // -1 denotes failure
    expect(
      calls[1][0].SetValue([[{ type: "a", child: [{ type: "d" }] }], [[]]]),
    ).toBe(-1); // -1 denotes failure
    expect(
      calls[1][0].SetValue([[{ type: "a", child: [{ type: "i" }] }], [[1]]]),
    ).toBe(-1);
  });
});

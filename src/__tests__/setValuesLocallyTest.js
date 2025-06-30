/* eslint-env node */
const { addVictronInterfaces } = require("../index");

describe("victron-dbus-virtual, setValuesLocally", () => {
  it("works for the happy case", async () => {
    const declaration = { name: "foo", properties: { SomeProp: "s", OtherProp: "i" } };
    const definition = { SomeProp: "my text" };
    const bus = {
      exportInterface: jest.fn(),
    };

    const cb = jest.fn();

    const { setValuesLocally } = addVictronInterfaces(bus, declaration, definition, false, cb);

    setValuesLocally({
      SomeProp: "text changed",
    })

    expect(definition.SomeProp).toBe("text changed");

    // ensure ItemsChanged is emitted, and only 'SomeProp' is included, not 'OtherProp'
    expect(cb).toHaveBeenCalledWith("ItemsChanged", [["/SomeProp", [['Value', ['s', 'text changed']], ['Text', ['s', 'text changed']]]]]);

  })

  it("fails if no properties are given", async () => {
    const declaration = { name: "foo", properties: { SomeProp: "s" } };
    const definition = { SomeProp: "my text" };
    const bus = {
      exportInterface: jest.fn(),
    };

    const cb = jest.fn();

    const { setValuesLocally } = addVictronInterfaces(bus, declaration, definition, false, cb);

    expect(() => {
      setValuesLocally({});
    }).toThrow("No values provided to setValuesLocally");
  })

  it("fails if a property is not defined in the declaration", async () => {
    const declaration = { name: "foo", properties: { SomeProp: "s" } };
    const definition = { SomeProp: "my text" };
    const bus = {
      exportInterface: jest.fn(),
    };

    const cb = jest.fn();

    const { setValuesLocally } = addVictronInterfaces(bus, declaration, definition, false, cb);

    expect(() => {
      setValuesLocally({
        UndefinedProp: "text changed",
      });
    }).toThrow("Property UndefinedProp not found in properties");
  })

  it("fails if a property value does not validate", async () => {
    const declaration = { name: "foo", properties: { IntProp: "i" } };
    const definition = { IntProp: 42 };
    const bus = {
      exportInterface: jest.fn(),
    };

    const cb = jest.fn();

    const { setValuesLocally } = addVictronInterfaces(bus, declaration, definition, false, cb);

    expect(() => {
      setValuesLocally({
        IntProp: "x"
      });
    }).toThrow("value for IntProp is not a number");

  });
})


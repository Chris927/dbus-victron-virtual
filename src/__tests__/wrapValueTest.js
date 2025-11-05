/* eslint-env node */
const { __private__: { wrapValue } } = require("../index");

describe("victron-dbus-virtual, wrapValue", () => {
  it("works for basic types", () => {
    expect(wrapValue("s", "hello")).toStrictEqual(["s", "hello"]);
    expect(wrapValue("i", 42)).toStrictEqual(["i", 42]);
    expect(wrapValue("b", true)).toStrictEqual(["b", true]);
    expect(wrapValue("d", 3.14)).toStrictEqual(["d", 3.14]);
  });
  it("works for number arrays", () => {
    expect(wrapValue("ad", [42, 42.1])).toStrictEqual(["ad", [42, 42.1]]);
    expect(() => wrapValue("ad", 3)).toThrow('value must be an array for type "ad"');
    expect(() => wrapValue("ad", [42, "42"])).toThrow('all items in array must be numbers for type "ad"');
  });
  it("works for string arrays", () => {
    expect(wrapValue("as", ["hello", "world"])).toStrictEqual(["as", ["hello", "world"]]);
    expect(() => wrapValue("as", "hello")).toThrow('value must be an array for type "as"');
  });
});



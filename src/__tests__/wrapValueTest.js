/* eslint-env node */
const { __private__: { wrapValue } } = require("../index");

describe("victron-dbus-virtual, wrapValue", () => {
  it("works for basic types", () => {
    expect(wrapValue("s", "hello")).toStrictEqual(["s", "hello"]);
    expect(wrapValue("i", 42)).toStrictEqual(["i", 42]);
    expect(wrapValue("b", true)).toStrictEqual(["b", true]);
    expect(wrapValue("d", 3.14)).toStrictEqual(["d", 3.14]);
  });
  it("works for string arrays", () => {
    expect(wrapValue("as", ["hello", "world"])).toStrictEqual(["as", ["hello", "world"]]);
  });
});



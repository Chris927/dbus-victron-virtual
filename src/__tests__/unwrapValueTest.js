/* eslint-env node */
const { __private__: { unwrapValue } } = require("../index");

describe("victron-dbus-virtual, unwrapValue", () => {
  it("works for basic types", () => {
    expect(unwrapValue([[{ type: "s" }], ["hello"]])).toBe("hello");
    expect(unwrapValue([[{ type: "i" }], [42]])).toBe(42);
    expect(unwrapValue([[{ type: "d" }], [42.1]])).toBe(42.1);
    expect(unwrapValue([[{ type: "b" }], [42]])).toBe(true);
    expect(unwrapValue([[{ type: "ad" }], [[42.1, 42.2]]])).toStrictEqual([42.1, 42.2]);
    expect(unwrapValue([[{ type: "ai" }], [[]]])).toBe(null);
    expect(unwrapValue([[{ type: "ai" }], [[42, 43]]])).toStrictEqual([42, 43]);
    expect(unwrapValue([[{ type: "as" }], [["42", "forty-three"]]])).toStrictEqual(["42", "forty-three"]);
  });
  it("throws on unknown type", () => {
    expect(() => unwrapValue([[{ type: "x" }], [42]])).toThrow('Unsupported value type: [{"type":"x"}]');
  });
  it('throws for mixed values in string array', () => {
    expect(() => unwrapValue([[{ type: "as" }], [["hello", 42]]])).toThrow('All items in string array must be strings');
  })
});




const { __private__: { getType } } = require("../index");

describe("victron-dbus-virtual, getType", () => {
  it("works for the happy case", () => {
    expect(getType(null)).toBe("d");
    expect(getType("text")).toBe("s");
    expect(getType(42)).toBe("i");
    expect(getType(42.2)).toBe("d");
  });
  it("throws for unknown types", () => {
    expect(() => getType({})).toThrow("Unsupported type: object");
    expect(() => getType(undefined)).toThrow("Value cannot be undefined");
    expect(() => getType(Number.NaN)).toThrow("NaN is not a valid input");
  });
});


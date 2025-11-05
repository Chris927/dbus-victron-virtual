const {
  __private__: { validateNewValue },
} = require("../index");

describe("validateNewValue", () => {
  it("works for basic types", () => {
    // type s or no type or unknown type result in string
    expect(validateNewValue("someName", {}, "some text")).toEqual("some text");
    expect(validateNewValue("someName", { type: "s" }, "some text")).toEqual(
      "some text",
    );
    expect(validateNewValue("someName", { type: "?" }, "some text")).toEqual(
      "some text",
    );
    expect(validateNewValue("someName", {}, 42)).toEqual("42");

    // boolean
    expect(validateNewValue("someName", { type: "b" }, true)).toEqual(true);
    expect(validateNewValue("someName", { type: "b" }, "true")).toEqual(true);
    expect(validateNewValue("someName", { type: "b" }, "1")).toEqual(true);
    expect(validateNewValue("someName", { type: "b" }, false)).toEqual(false);
    expect(validateNewValue("someName", { type: "b" }, "false")).toEqual(false);
    expect(validateNewValue("someName", { type: "b" }, "0")).toEqual(false);

    // integer and double
    expect(validateNewValue("someName", { type: "i" }, 42)).toEqual(42);
    expect(validateNewValue("someName", { type: "i" }, 42.2)).toEqual(42);
    expect(validateNewValue("someName", { type: "i" }, "42")).toEqual(42);
    expect(validateNewValue("someName", { type: "i" }, "42.2")).toEqual(42);
    expect(validateNewValue("someName", { type: "i" }, true)).toEqual(1); // javascript semantics, what can I say...
    expect(validateNewValue("someName", { type: "i" }, [])).toEqual(0); // javascript semantics, what can I say...
    expect(validateNewValue("someName", { type: "d" }, 42.2)).toEqual(42.2);

    // array of strings
    expect(validateNewValue("someName", { type: "as" }, ["hello", "world"])).toEqual([
      "hello",
      "world",
    ]);

    // array of integers (nope, not supported currently)
    // expect(validateNewValue("someName", { type: "ai" }, [1, 2, 3])).toEqual([1, 2, 3]);
    // expect(validateNewValue("someName", { type: "ai" }, [1.2, 2.5, 3.9])).toEqual([1, 2, 3]);
    // expect(validateNewValue("someName", { type: "ai" }, ["1", "2", "3"])).toEqual([1, 2, 3]);

    // array of doubles
    expect(validateNewValue("someName", { type: "ad" }, [1.1, 2.2, 3.3])).toEqual([1.1, 2.2, 3.3]);
    expect(validateNewValue("someName", { type: "ad" }, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(validateNewValue("someName", { type: "ad" }, ["1.1", "2.2", "3.3"])).toEqual([1.1, 2.2, 3.3]);
  });
  it("throws in expected cases", () => {
    const cases = {
      // Invalid boolean
      c: () => validateNewValue("someName", { type: "b" }, "some text"),
      e: () => validateNewValue("someName", { type: "b" }, 2),
      f: () => validateNewValue("someName", { type: "b" }, "3"),
      // Invalid integer
      g: () => validateNewValue("someName", { type: "i" }, "some text"),
      h: () => validateNewValue("someName", { type: "i" }, Number.NaN),
      // Invalid double
      i: () => validateNewValue("someName", { type: "d" }, "some text"),
      j: () => validateNewValue("someName", { type: "d" }, Number.NaN),
      // min and max
      k: () => validateNewValue("someName", { type: "i", min: 0 }, -1),
      l: () => validateNewValue("someName", { type: "i", max: 1 }, 2),
    };

    for (const key in cases) {
      expect(() => {
        cases[key]();
        console.error(`Case ${key} did not throw`);
      }).toThrow();
    }
  });
});

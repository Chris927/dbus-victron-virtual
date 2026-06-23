/* eslint-env node */
const { addVictronInterfaces } = require("../index");

describe("Mgmt/Connection override", () => {
  it("sets Mgmt/Connection as readonly by default", () => {
    const bus = { exportInterface: jest.fn() };
    const declaration = { name: "com.victronenergy.ev.virtual_test", properties: { Soc: { type: "d" } } };
    const definition = { Soc: null };

    addVictronInterfaces(bus, declaration, definition);

    expect(declaration.properties["Mgmt/Connection"].readonly).toBe(true);
    expect(definition["Mgmt/Connection"]).toBe("Node-RED");
  });

  it("respects a pre-declared Mgmt/Connection without readonly", () => {
    const bus = { exportInterface: jest.fn() };
    const declaration = {
      name: "com.victronenergy.ev.virtual_test",
      properties: { Soc: { type: "d" }, "Mgmt/Connection": { type: "s" } }
    };
    const definition = { Soc: null, "Mgmt/Connection": null };

    addVictronInterfaces(bus, declaration, definition);

    expect(declaration.properties["Mgmt/Connection"].readonly).toBeUndefined();
  });

  it("allows setValuesLocally on a pre-declared Mgmt/Connection", () => {
    const bus = { exportInterface: jest.fn() };
    const declaration = {
      name: "com.victronenergy.ev.virtual_test",
      properties: { Soc: { type: "d" }, "Mgmt/Connection": { type: "s" } }
    };
    const definition = { Soc: null, "Mgmt/Connection": null };

    const { setValuesLocally } = addVictronInterfaces(bus, declaration, definition);

    expect(() => setValuesLocally({ "Mgmt/Connection": "Tesla Model 3" })).not.toThrow();
    expect(definition["Mgmt/Connection"]).toBe("Tesla Model 3");
  });

  it("rejects setValuesLocally on default readonly Mgmt/Connection", () => {
    const bus = { exportInterface: jest.fn() };
    const declaration = { name: "com.victronenergy.ev.virtual_test", properties: { Soc: { type: "d" } } };
    const definition = { Soc: null };

    const { setValuesLocally } = addVictronInterfaces(bus, declaration, definition);

    expect(() => setValuesLocally({ "Mgmt/Connection": "Custom" })).toThrow(/readonly/);
  });

  it("preserves an existing Mgmt/Connection value in the definition", () => {
    const bus = { exportInterface: jest.fn() };
    const declaration = {
      name: "com.victronenergy.ev.virtual_test",
      properties: { Soc: { type: "d" }, "Mgmt/Connection": { type: "s" } }
    };
    const definition = { Soc: null, "Mgmt/Connection": "pre-set value" };

    addVictronInterfaces(bus, declaration, definition);

    expect(definition["Mgmt/Connection"]).toBe("pre-set value");
  });

  it("sets default Mgmt/Connection value to Node-RED when definition has null", () => {
    const bus = { exportInterface: jest.fn() };
    const declaration = {
      name: "com.victronenergy.ev.virtual_test",
      properties: { Soc: { type: "d" }, "Mgmt/Connection": { type: "s" } }
    };
    const definition = { Soc: null, "Mgmt/Connection": null };

    addVictronInterfaces(bus, declaration, definition);

    expect(definition["Mgmt/Connection"]).toBe("Node-RED");
  });
});

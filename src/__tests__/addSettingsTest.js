const { addSettings } = require("..");

describe("victron-dbus-virtual, addSettings tests, without calling addVictronInterfaces", () => {
  it("works for the happy case", async () => {
    const bus = {
      invoke: function (args, cb) {
        process.nextTick(() => cb(null, args));
      },
    };
    const settingsResult = await addSettings(bus, [
      {
        path: "/Settings/MySettings/Setting",
        default: 3,
        min: 0,
        max: 10,
      },
    ]);
    expect(settingsResult.member).toBe("AddSettings");
    expect(settingsResult.path).toBe("/");
    expect(settingsResult.interface).toBe("com.victronenergy.Settings");
    expect(settingsResult.body).toStrictEqual([
      [
        [
          ["path", ["s", "/Settings/MySettings/Setting"]],
          ["default", ["i", 3]],
        ],
      ],
    ]);
  });
});

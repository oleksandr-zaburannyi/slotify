import {Settings} from "./Settings";

test("Settings - priorities", async () => {
    jest.spyOn(Settings, "getConfig").mockImplementationOnce(async () => {
        return [
            {key: "testKey", value: "testValue1", priority: 200},
            {key: "testKey", value: "testValue2", priority: 300},
            {key: "testKey", value: "testValue3", priority: 100},
        ].map(item => Object.assign(item, new Settings()));
    });

    await expect(await Settings.getValues({})).toEqual({"testKey": "testValue2"});
});

test("Settings - filters", async () => {
    jest.spyOn(Settings, "getConfig").mockImplementationOnce(async () => {
        return [
            {key: "testKey", value: "testValue1", priority: 200, operators: ["a", "b"]},
            {key: "testKey", value: "testValue2", priority: 300, operators: ["b", "c"]},
            {key: "testKey", value: "testValue3", priority: 100, operators: ["a", "c"]},
        ].map(item => Object.assign(item, new Settings()));
    });

    await expect(await Settings.getValues({operator: "x"})).toEqual({});
});

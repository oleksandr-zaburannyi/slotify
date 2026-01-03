import {isDevMode} from "./isDevMode";

test("mode", () => {
    expect(isDevMode()).toEqual(false);

    process.env.IS_PRODUCTION = "true";
    expect(isDevMode()).toEqual(false);

    process.env.IS_PRODUCTION = "false";
    expect(isDevMode()).toEqual(true);

    process.env.IS_PRODUCTION = "yes";
    expect(isDevMode()).toEqual(false);

    process.env.IS_PRODUCTION = "nope";
    expect(isDevMode()).toEqual(false);
});

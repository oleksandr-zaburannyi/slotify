import {clearEmpty} from "./clearEmpty";

test("clearEmpty", () => {
    expect(clearEmpty({})).toEqual({});
    expect(clearEmpty({a: 1, b: "abc"})).toEqual({a: 1, b: "abc"});
    expect(clearEmpty({a: undefined, b: "abc", c: null})).toEqual({b: "abc"});
    expect(clearEmpty({a: undefined, b: undefined, c: null})).toEqual({});
});

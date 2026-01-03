import removeUnderscoredKeys from "./removeUnderscoredKeys";

test("removeUnderscoredKeys", () => {
    expect(removeUnderscoredKeys({a: 1, b: 2, c: 3})).toEqual({a: 1, b: 2, c: 3});
    expect(removeUnderscoredKeys({a: 1, _b: 2, c: 3})).toEqual({a: 1, c: 3});
    expect(removeUnderscoredKeys({_a: 1, _b: 2, _c: 3})).toEqual({});
});

import {deepObjectAssign} from "./deepObjectAssign";

test("deepObjectAssign", () => {
    const obj1 = {a: 1, b: {a: 1, b: 2}};
    const obj2 = {b: {a: "XXX", c: 3}, c: 3};
    expect(deepObjectAssign(obj1, obj2)).toEqual({a: 1, b: {a: "XXX", b: 2, c: 3}, c: 3});
});

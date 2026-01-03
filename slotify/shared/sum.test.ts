import sum from "./sum";

test("sums array elements", () => {
    expect(sum([1, 2, 3])).toEqual(6);
});

test("returns undefined from empty array", () => {
    expect(sum([])).toEqual(0);
});

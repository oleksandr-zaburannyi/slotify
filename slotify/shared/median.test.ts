import median from "./median";

test("median of array elements", () => {
    expect(median([1, 2, 3])).toEqual(2);
    expect(median([1, 2, 3, 4])).toEqual(2.5);
});

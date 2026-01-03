import countDecimals from "./countDecimals";

test("countDecimals", () => {
    expect(countDecimals(100)).toEqual(0);
    expect(countDecimals(100.1)).toEqual(1);
    expect(countDecimals(100.1)).toEqual(1);
    expect(countDecimals(100.1)).toEqual(1);
    expect(countDecimals(100.11)).toEqual(2);
    expect(countDecimals(100.111)).toEqual(3);
    expect(countDecimals(100.111)).toEqual(3);
    expect(countDecimals(1)).toEqual(0);
    expect(countDecimals(2e-7)).toEqual(7);
    expect(countDecimals(3.14e-5)).toEqual(7);
    expect(countDecimals(1)).toEqual(0);
});

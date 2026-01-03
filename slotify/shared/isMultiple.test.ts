import {isMultiple} from "./isMultiple";

test("is multiple", () => {
    expect(isMultiple(2, 2)).toEqual(true);
    expect(isMultiple(3, 2)).toEqual(false);
    expect(isMultiple(4, 2)).toEqual(true);
    expect(isMultiple(10, 2)).toEqual(true);

    expect(isMultiple(0.2, 0.2)).toEqual(true);
    expect(isMultiple(0.3, 0.2)).toEqual(false);
    expect(isMultiple(0.4, 0.2)).toEqual(true);
    expect(isMultiple(1, 0.2)).toEqual(true);
    expect(isMultiple(2, 0.2)).toEqual(true);
    expect(isMultiple(3, 0.2)).toEqual(true);
    expect(isMultiple(1.4, 0.2)).toEqual(true);
    expect(isMultiple(1.3, 0.2)).toEqual(false);
});

import {round} from "./round";

test("round", () => {
    expect(round(1)).toEqual(1);

    expect(round(0.5, 0)).toEqual(1);

    expect(round(1.4, 0)).toEqual(1);
    expect(round(1.5, 0)).toEqual(2);

    expect(round(0.04, 1)).toEqual(0);
    expect(round(0.05, 1)).toEqual(0.1);

    expect(round(0.004, 2)).toEqual(0);
    expect(round(0.015, 2)).toEqual(0.02);

    expect(round(9361627.37, 2)).toEqual(9361627.37);
});

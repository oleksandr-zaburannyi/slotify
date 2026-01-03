import {floor} from "./floor";

test("floor", () => {
    expect(floor(10002.8 + 0.4, 2)).toEqual(10003.2);
    expect(floor(0.01546875, 2)).toEqual(0.01); // Mines game: 1 mine, 9 picks, 1546875 multiplier, 1 cent bet
    expect(floor(0.01546875 * 2, 2)).toEqual(0.03);
    expect(floor(21060000000, 0)).toEqual(21060000000); // IRR currency big win
    expect(floor(21060000000, 2)).toEqual(21060000000);
    expect(floor(21060000000, 8)).toEqual(21060000000);

    expect(floor(0.011, 8)).toEqual(0.011);
    expect(floor(0.011, 3)).toEqual(0.011);
    expect(floor(0.011, 2)).toEqual(0.01);
    expect(floor(0.01 * 1.1, 8)).toEqual(0.011);

    expect(floor(0.000001 * 15, 8)).toEqual(0.000015);
    expect(floor(0.000001 * 15, 7)).toEqual(0.000015);
    expect(floor(0.000001 * 15, 6)).toEqual(0.000015);
    expect(floor(0.000001 * 15, 5)).toEqual(0.00001);
    expect(floor(0.000001 * 15, 4)).toEqual(0);

    expect(floor(0.000001 * 25, 8)).toEqual(0.000025);
    expect(floor(0.000001 * 25, 7)).toEqual(0.000025);
    expect(floor(0.000001 * 25, 6)).toEqual(0.000025);
    expect(floor(0.000001 * 25, 5)).toEqual(0.00002);
    expect(floor(0.000001 * 25, 4)).toEqual(0);

    expect(floor(0.00000000001 * 15, 13)).toEqual(0.00000000015);
    expect(floor(0.00000000001 * 15, 12)).toEqual(0.00000000015);
    expect(floor(0.00000000001 * 15, 11)).toEqual(0.00000000015);
    expect(floor(0.00000000001 * 15, 10)).toEqual(0.0000000001);
    expect(floor(0.00000000001 * 15, 9)).toEqual(0);

    expect(floor(0.00000000001 * 25, 13)).toEqual(0.00000000025);
    expect(floor(0.00000000001 * 25, 12)).toEqual(0.00000000025);
    expect(floor(0.00000000001 * 25, 11)).toEqual(0.00000000025);
    expect(floor(0.00000000001 * 25, 10)).toEqual(0.0000000002);
    expect(floor(0.00000000001 * 25, 9)).toEqual(0);

    expect(floor(1 - 1e-11)).toEqual(0.99);
    expect(floor(1 - 1e-11, 0)).toEqual(0);
    expect(floor(1 - 1e-11, 2)).toEqual(0.99);
    expect(floor(1 - 1e-11, 1)).toEqual(0.9);
    expect(floor(1 - 1e-11, 0)).toEqual(0);
    expect(floor(0.5, 0)).toEqual(0);
    expect(floor(1.4, 0)).toEqual(1);
    expect(floor(1.5, 0)).toEqual(1);
    expect(floor(0.04, 1)).toEqual(0);
    expect(floor(0.09, 1)).toEqual(0);
    expect(floor(0.004, 2)).toEqual(0);
    expect(floor(0.015, 2)).toEqual(0.01);
    expect(floor(0.02 - 1e-11, 2)).toEqual(0.01);
    expect(floor(-0.004, 2)).toEqual(-0.01);
    expect(floor(-0.015, 2)).toEqual(-0.02);
    expect(floor(-0.02 - 1e-11, 2)).toEqual(-0.03);
    expect(floor(9.7)).toEqual(9.7);
    expect(floor(0.00000001, 2)).toEqual(0.0);
    expect(floor(0.50000001, 2)).toEqual(0.5);
    expect(floor(0.00000001, 10)).toEqual(0.00000001);
    expect(floor(0.000000012, 8)).toEqual(0.00000001);
    expect(floor(9361627.37, 2)).toEqual(9361627.37);
    expect(floor(12378612836812, 8)).toEqual(12378612836812);
});

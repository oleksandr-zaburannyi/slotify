export function unbiasedRandomInteger(limit: number, randomInt32: () => number): number {
    let power = 1;
    while (power < limit) {
        power *= 2;
    }

    let number;
    do {
        const int = randomInt32();
        number = int % power;
    } while (number >= limit);

    return number;
}

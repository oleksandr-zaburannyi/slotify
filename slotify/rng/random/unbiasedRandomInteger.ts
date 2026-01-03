export function unbiasedRandomInteger(limit: number, random: () => number) {
    let power = 1;
    while (power < limit) {
        power *= 2;
    }

    let number;
    do {
        const int = random();
        number = int % power;
    } while (number >= limit);

    return number;
}

function randomInteger(limit: number, random: () => number): number {
    let power = 1;
    while (power < limit) {
        power *= 2;
    }

    let number;
    do {
        const int = random() / 2.3283064365386963e-10; //2^-32
        number = int % power;
    } while (number >= limit);

    return number;
}

export default randomInteger;

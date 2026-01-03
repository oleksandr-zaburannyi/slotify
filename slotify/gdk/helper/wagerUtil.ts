export function sumOfWins(wagers: {win: number}[]): number {
    let sum = 0;
    const len = wagers.length;
    for (let i = 0; i < len; i++) {
        sum += wagers[i].win;
    }
    return sum;
}

export function sumOfBets(wagers: {bet: number; sideBet?: number}[]): number {
    let sum = wagers.length > 0 ? wagers[0].bet : 0;
    const len = wagers.length;
    for (let i = 0; i < len; i++) {
        sum += wagers[i].sideBet || 0;
    }
    return sum;
}

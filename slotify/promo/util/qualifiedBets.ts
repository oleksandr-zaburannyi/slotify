export function isQualifyingBet(bet: number, qualifyingBet: number): boolean {
    return bet >= qualifyingBet;
}

export function incrementQualifiedBets(current?: number): number {
    return (current ?? 0) + 1;
}

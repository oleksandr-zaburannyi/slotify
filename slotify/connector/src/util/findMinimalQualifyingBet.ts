import {IBets} from "../Connector";

export function findMinimalQualifyingBet(bets: IBets | undefined, playerState: any): number | undefined {
    let minBet: number | undefined = undefined;
    for (const {available} of Object.values(bets || [])) {
        if (Array.isArray(available)) {
            const min = available.sort((a, b) => a - b).find(bet => bet >= playerState.exchangedQualifyingBet);
            if (min) {
                minBet = Math.min(minBet || min, min);
            }
        } else {
            let min = available.min;
            while (min <= available.max) {
                if (min >= playerState.exchangedQualifyingBet) {
                    minBet = Math.min(minBet || min, min);
                    break;
                }
                min = parseFloat((min + available.step).toFixed(2));
            }
        }
    }
    return minBet;
}

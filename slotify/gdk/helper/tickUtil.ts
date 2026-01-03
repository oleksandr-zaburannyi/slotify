import sum from "@slotify/shared/lib/sum";

export function sumOfWins(ticks: {wins?: Record<string, number>}[]): number {
    return sum(ticks.flatMap(tick => Object.values(tick.wins || {})));
}

export function sumOfBets(ticks: {commands: {commandId: string; bet?: number}[]; cancels?: string[]}[]): number {
    const cancelledComamnds = new Set(ticks.flatMap(tick => tick.cancels || []));
    return sum(ticks.flatMap(tick => tick.commands.filter(command => !cancelledComamnds.has(command.commandId)).map(command => command.bet || 0)));
}

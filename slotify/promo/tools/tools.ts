import Exception from "@slotify/shared/lib/Exception";
import {ITool} from "../util/ITool";
import {freeBets} from "./freeBets";
import {prizeDrop} from "./prizeDrop";
import {tournament} from "./tournament";
import {leaderboard} from "./leaderboard";
import {initStreams} from "../util/streams";
import {gameJackpot} from "./jackpots/gameJackpot";
import {transactionJackpot} from "./jackpots/transactionJackpot";

export type IToolType = keyof typeof tools;

export const tools: Record<string, ITool> = {
    "freeBets": freeBets,
    "prizeDrop": prizeDrop,
    "tournament": tournament,
    "leaderboard": leaderboard,
    "transactionJackpot": transactionJackpot,
    "gameJackpot": gameJackpot,
};

export function getTool(tool: IToolType): ITool {
    if (!tools[tool]) {
        throw new Exception(`Couldn't find tool '${tool}'`);
    }
    return tools[tool];
}

export async function initToolsStreams() {
    for (const [toolId, tool] of Object.entries(tools)) {
        if (tool.accumulator) {
            await initStreams(toolId, tool.accumulator);
        }
    }
}

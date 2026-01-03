import {simulator} from "./simulator";
import {IMultiplayerGame, ITick} from "../IMultiplayerGame";
import {createRandom} from "@slotify/rng/lib/random/factory";
import {v4} from "uuid";
import {mockBetLimits} from "../helper/mockBetLimits";

type InitData = {
    strategy?: string;
    state: any;
    time: number;
    nextTime: number;
    commandLagProbability: number;
};

type IRunData = {
    state: any;
    time: number;
    nextTime: number;
};

simulator<IMultiplayerGame, ITick, IRunData, InitData>(
    "slotify-stats-multiplayer",
    command => {
        command.option("-s, --strategy <string>", "simulation strategy").option("-l, --lag <string>", "command lag probability (in percentage)");
    },
    (game, {strategy, lag}) => {
        return {
            "Command lag probability": lag || 0 + "%",
            "Strategy": strategy || "",
        };
    },
    async (env, game) => {
        const roomId = v4();
        const config = game.simulator?.config && game.simulator.config(env.strategy!);
        const time = Date.now();
        const initResult = await game.init({time, roomId, config}, createRandom());
        const nextTime = initResult.nextTickTime;
        const state = initResult.state;
        return {
            commandLagProbability: parseInt(env.lag || "0") / 100,
            time,
            state,
            nextTime,
            strategy: env.strategy,
        };
    },
    true,
    async (initData, runData, game) => {
        let state = runData?.state || initData.state;
        let time = runData?.time || initData.time;
        let nextTime = runData?.nextTime || initData.nextTime;
        const drawId = v4();

        const ticks: ITick<any, any>[] = [];
        let drawFinished: boolean | undefined;
        let laggedCommands: any[] = [];
        do {
            const commands: any[] = [];
            let scheduleInstant = false;
            for (const command of laggedCommands.concat((game.simulator?.commands && game.simulator?.commands(initData.strategy, state)) || [])) {
                laggedCommands = [];
                const {valid, instantTick} = game.command({...command, state, time, betLimits: mockBetLimits});
                if (valid) {
                    if (Math.random() < initData.commandLagProbability) {
                        laggedCommands.push(command);
                    } else {
                        commands.push({...command, state, time});
                    }
                    if (instantTick) {
                        scheduleInstant = true;
                    }
                }
            }
            if (!scheduleInstant) time = nextTime;

            const tickRequest = {time, state, commands, drawId};
            const tickResult = await game.tick(tickRequest, createRandom());
            nextTime = tickResult.nextTickTime;
            state = tickResult.state;
            drawFinished = tickResult.drawFinished;
            ticks.push({...tickRequest, ...tickResult});
        } while (!drawFinished);

        return {runData: {time, state, nextTime}, statsData: ticks};
    },
    game => game.simulator?.stats || {},
    (stat, ticks) => stat.processAllTicks(ticks),
);

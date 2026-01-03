import {IBetLimits, IGame, IPlayRequest} from "../../../IGame";
import RTP from "../../../stats/RTP";

export const index: IGame<any> = {
    name: "testgame",
    bets: {
        "main": {available: [0.2, 1, 5], default: 1, maxWin: 100, coin: 10},
    },
    config(variant) {
        return {testConfig: true, _privateField: true, variant};
    },
    cheats: {
        "main": {
            "win": wager => wager.win > 0,
            "impossible": wager => wager.win > 100,
        },
    },
    stats: {
        "RTP": new RTP(),
    },
    play({bet, variant, coin, action}, random) {
        const win = random(5) === 0 ? bet! * 2 : 0;
        const next = action === "main" ? ["bonus"] : undefined;
        return {data: {variant, coin}, win, next, state: {testState: 123, _myPrivateState: 456}};
    },
    action(wager) {
        return {
            action: wager.next![0],
        };
    },
    validate(request: IPlayRequest<any, any>, betLimits: IBetLimits): boolean {
        return request.bet >= betLimits.minBet;
    },
};

export default index;

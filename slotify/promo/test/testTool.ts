import {ITool} from "../util/ITool";

export const testTool: ITool = {
    async create() {},
    async edit() {},
    async init() {
        return {playerState: {ps: "init"}, logs: [{name: "init", data: {log: "init"}}]};
    },
    async opt() {
        return {playerState: {ps: "opt", _ps: "opt"}, campaignState: {cs: "opt", _cs: "opt"}, logs: [{name: "opt", data: {log: "opt"}}]};
    },
    async acknowledge() {
        return {playerState: {ps: "acknowledge"}, campaignState: {cs: "acknowledge"}, logs: [{name: "acknowledge", data: {log: "acknowledge"}}]};
    },
    async playerEvent() {
        return {
            data: {myResponse: 123},
            playerState: {ps: "playerEvent"},
            campaignState: {cs: "playerEvent"},
            logs: [{name: "playerEvent", data: {log: "playerEvent"}}],
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
            finished: true,
        };
    },
    async systemEvent() {
        return {
            data: {myResponse: 123},
            playerState: {ps: "systemEvent"},
            campaignState: {cs: "systemEvent"},
            logs: [{name: "systemEvent", data: {log: "systemEvent"}}],
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        };
    },
    async campaignFeed({params}) {
        return {...params, otherData: 2};
    },
    async playerFeed({params}) {
        return {...params, otherData: 2};
    },
    async withdraw() {
        return {
            playerState: {ps: "withdraw"},
            campaignState: {cs: "withdraw"},
            jackpotAmount: 100,
            logs: [{name: "withdraw", data: {log: "withdraw"}}],
            finished: false,
            free: true,
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        };
    },
    async withdrawFinished() {
        return {
            playerState: {ps: "withdrawFinished"},
            campaignState: {cs: "withdrawFinished"},
            data: {d: "withdrawFinished"},
            logs: [{name: "withdrawFinished", data: {log: "withdrawFinished"}}],
            finished: false,
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        };
    },
    async deposit() {
        return {
            playerState: {ps: "deposit"},
            campaignState: {cs: "deposit"},
            jackpotAmount: 100,
            logs: [{name: "deposit", data: {log: "deposit"}}],
            finished: false,
            free: true,
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        };
    },
    async depositFinished() {
        return {
            playerState: {ps: "depositFinished"},
            campaignState: {cs: "depositFinished"},
            data: {d: "depositFinished"},
            logs: [{name: "depositFinished", data: {log: "depositFinished"}}],
            finished: true,
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        };
    },
    async cancel() {
        return {
            playerState: {ps: "cancel"},
            campaignState: {cs: "cancel"},
            logs: [{name: "cancel", data: {log: "cancel"}}],
        };
    },
    async campaignEnd() {
        return {
            campaignState: {cs: "campaignEnd"},
            logs: [{name: "campaignEnd", data: {log: "campaignEnd"}}],
            prizes: [{type: "cash", data: {amount: 100, jackpotAmount: 10, currency: "sek"}, playerId: "3d64b149-6186-407b-9265-34122d41b176"}],
        };
    },
};

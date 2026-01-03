import {IGame, IGameBets} from "../../../IGame";

export const index: IGame<any> = {
    name: ["testmultigame1", "testmultigame2"],
    bets(variant: string = "defaultVariant"): IGameBets {
        return variant === "defaultVariant"
            ? {
                  "main": {available: [13], default: 13, maxWin: 1, coin: 13},
              }
            : {
                  "customVariantAction": {available: [1], default: 1, maxWin: 1, coin: 1},
              };
    },
    config(variant = "defaultVariant") {
        return {variant};
    },
    play() {
        return {
            win: 13,
        };
    },
};

export default index;

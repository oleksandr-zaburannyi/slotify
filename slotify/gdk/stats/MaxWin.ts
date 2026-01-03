import Max from "./Max";
import {sumOfBets, sumOfWins} from "../helper/wagerUtil";

export default class MaxWin<T = any> extends Max<T> {
    constructor() {
        super(wagers => sumOfWins(wagers) / sumOfBets(wagers));
    }

    message() {
        return "x" + super.message();
    }
}

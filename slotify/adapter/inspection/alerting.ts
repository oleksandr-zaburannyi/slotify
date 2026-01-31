import {ITransaction} from "../walletAdapter/IWalletAdapter";
import {Player} from "../db/model/Player";
import * as process from "process";
import currencies from "../route/currencies";
import cache from "@slotify/shared/lib/cache";
import {sendAlert} from "@slotify/shared/lib/sendAlert";
import {Transaction} from "../db/model/Transaction";
import {ReportExclusion} from "../db/model/ReportExclusion";

const getCurrencies = cache(10 * 60, currencies, ["currencyRates"]);

const formatCurrency = (value: number, currency: string) => new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value) + " " + currency;

const alertText = (transaction: ITransaction, player: Player, totalBet: number, totalWin: number, betInBaseCurrency: number, winInBaseCurrency: number, winRatio: number, exclusionReason?: string) => `
    Win: ${formatCurrency(totalWin, player.currency)} ${player.currency === process.env.BASE_CURRENCY ? "" : "(" + formatCurrency(winInBaseCurrency, process.env.BASE_CURRENCY!) + ")"}<br/>
    Bet: ${formatCurrency(totalBet, player.currency)} ${player.currency === process.env.BASE_CURRENCY ? "" : "(" + formatCurrency(betInBaseCurrency, process.env.BASE_CURRENCY!) + ")"}<br/>
    Win ratio (main bet): x${(transaction.winRatio || winRatio).toFixed(2)}<br/>
    Win ratio (wins/bets): x${winRatio.toFixed(2)}<br/>
    Game: ${transaction.game}<br/>
    Wallet: ${player.wallet}<br/>
    Operator: ${player.operator}<br/>
    Brand: ${player.brand}<br/>
    Player id: ${player.id}<br/>
    Player nativeId: ${player.nativeId}<br/>
    Player group: ${player.group || ""}<br/>
    Exclusion reason: ${exclusionReason || ""}<br/>

    <br/>
    <a href="${process.env.URL}/backoffice/rounds/${transaction.roundId}">Open in Back office</a> <br/>
`;

type IConfig = {maxWin?: number; maxWinRatio?: number};

export async function alerting(config: IConfig, transaction: ITransaction, transactions: Transaction[], player: Player, isPlayerExcluded: boolean) {
    const alerts = [];

    const rate = (await getCurrencies()).currencies.find(item => item.currency === player.currency)?.rate ?? 1;

    const totalBet = transactions.filter(t => t.type === "withdraw").reduce((prev, current) => prev + current.amount, 0);
    const totalWin = transactions.filter(t => t.type === "deposit").reduce((prev, current) => prev + current.amount, 0);
    const betInBaseCurrency = rate ? totalBet / rate : 0;
    const winInBaseCurrency = rate ? totalWin / rate : 0;

    if (config.maxWin != null && transaction.type === "deposit" && winInBaseCurrency >= config.maxWin && !isPlayerExcluded) {
        alerts.push("Big win amount");
    }
    if (config.maxWinRatio != null && transaction.type === "deposit" && transaction.winRatio! >= config.maxWinRatio && !isPlayerExcluded) {
        alerts.push("Big win ratio");
    }

    if (alerts.length > 0) {
        const {reason: exclusionReason} = await ReportExclusion.isPlayerExcluded(player.id);
        const title = `[alert] ${alerts.join(", ")}`;
        sendAlert(title, alertText(transaction, player, totalBet, totalWin, betInBaseCurrency, winInBaseCurrency, totalWin / totalBet, exclusionReason));
    }
}

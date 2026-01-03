import {ITransaction} from "../walletAdapter/IWalletAdapter";
import * as process from "process";
import {Transaction} from "../db/model/Transaction";
import Exception from "@slotify/shared/lib/Exception";
import {sendAlert} from "@slotify/shared/lib/sendAlert";

const validationErrorText = (description: string, transaction: ITransaction) => `
    Detected transaction validation error (${description}).
    Such API call should not be possible which indicates API manipulation or a bug.
    Please investigate with the highest priority.
    <br/><br/>
    <a href="${process.env.URL}/backoffice/rounds/${transaction.roundId}">Open in Back office</a> <br/>
`;

function validationError(description: string, transaction: ITransaction, transactions: Transaction[]) {
    sendAlert("Transaction validation error", validationErrorText(description, transaction), true);
    throw new Exception(description, {data: {transaction, transactions}});
}

type IConfig = {maxWithdraws?: number; maxDeposits?: number};

export async function validation(config: IConfig, transactionId: string, transaction: ITransaction, transactions: Transaction[]) {
    if (transactions.find(t => t.playerId !== transactions[0].playerId)) {
        validationError("Round has already transactions from another player", transaction, transactions);
    }

    if (transactions.find(t => t.roundFinished && t.id !== transactionId)) {
        validationError("Round already finished", transaction, transactions);
    }

    if (transaction.category === "normal" && transactions.find(t => t.game !== transactions[0].game)) {
        validationError("Round has already transactions from another game", transaction, transactions);
    }

    const withdrawals = transactions.filter(t => t.type === "withdraw").length;
    if (config.maxWithdraws != null && transaction.type === "withdraw" && withdrawals > config.maxWithdraws) {
        validationError("Exceeded number of withdrawals", transaction, transactions);
    }

    const deposits = transactions.filter(t => t.type === "deposit").length;
    if (config.maxDeposits != null && transaction.type === "deposit" && deposits > config.maxDeposits) {
        validationError("Exceeded number of deposits", transaction, transactions);
    }

    if (transaction.category !== "promo" && transaction.type === "deposit" && !transactions.find(t => t.type === "withdraw" && t.status === "finished")) {
        validationError("There is no corresponding withdraw", transaction, transactions);
    }

    if (transaction.amount < 0) {
        validationError("Transaction amount must be greater or equal than zero", transaction, transactions);
    }
}

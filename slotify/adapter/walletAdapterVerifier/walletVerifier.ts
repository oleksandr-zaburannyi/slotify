import {Player} from "../db/model/Player";
import IWalletAdapter, {ISession, IWalletAuthenticate, IWalletBalance} from "../walletAdapter/IWalletAdapter";
import {errorCodes, getWalletAdapter} from "../walletAdapter/walletAdapter";
import {round} from "@slotify/shared/lib/round";
import Exception from "@slotify/shared/lib/Exception";
import {v4} from "uuid";
import logger from "@slotify/shared/lib/logger";
import {Session} from "../db/model/Session";

export interface IWalletDebug {
    url: string;
    method: string;
    body: string;
    headers: any[];
    status: number;
    text: string;
    responseHeaders: any[];
}

const baseWalletTransaction = {
    createdAt: new Date(),
    rgs: "test-rgs",
    playerId: v4(),
    rgsTransactionId: v4(),
};

export default async function walletVerifier(wallet: string, operator: string, provider: string, key: string, game: string, key2?: string, game2?: string) {
    const tests: {name: string; passed: boolean; message: string}[] = [];
    const requests: Record<string, IWalletDebug> = {};
    const test = (name: string, passed: boolean, message: string) => {
        tests.push({name, passed: Boolean(passed), message});
    };

    const walletAdapter: IWalletAdapter & {__debug: IWalletDebug | null} = (await getWalletAdapter(wallet)) as any;
    const correctKey = walletAdapter.config.secretKey;
    const incorrectKey = "incorrectSecretKey";

    let player1: Player = Player.create();
    let player2: Player = Player.create();
    let session1: ISession | null = null;
    let session2: ISession | null = null;

    let balance: number | undefined;
    const transactionIdPrefix = "t_" + new Date().getTime();
    const roundIdPrefix = "r_" + new Date().getTime();

    {
        const NAME = "Successful authorization";
        let response: IWalletAuthenticate | null = null;
        // let error: Error;
        try {
            response = await walletAdapter.authenticate(key, operator, provider, game);
            const {nativeId, token, currency, brand, country, nickname, gender, jurisdiction} = response;
            player1 = await Player.getOrCreate(nativeId, wallet, operator, {currency, brand, country, nickname, gender, jurisdiction});
            await Session.init(player1.id, token, key, provider, game);
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, {error: e});
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = response?.balance;
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.nativeId === "string", "nativeId field should be a string");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, typeof response?.token === "string", "token field should be a string");
            test(NAME, typeof response?.currency === "string" && response?.currency === response?.currency.toLowerCase(), "currency field should be a lowercase string");
            test(NAME, typeof response?.brand === "string", "brand field should be a string");
            test(NAME, !!response && (!response.nickname || typeof response?.nickname === "string"), "nickname field should be a string or empty");
            test(NAME, !!response && (!response.country || (typeof response?.country === "string" && response.country === response.country.toLocaleLowerCase())), "country field should be a lowercase string or empty");
            test(NAME, !!response && (!response.gender || ["m", "f"].indexOf(response.gender) >= 0), "gender field should be a 'm', 'f' or empty");
            test(
                NAME,
                !!response && (!response.jurisdiction || (typeof response?.jurisdiction === "string" && response.jurisdiction === response.jurisdiction.toLocaleLowerCase())),
                "jurisdiction field should be a lowercase string or empty",
            );
        }
    }
    try {
        session1 = await Session.getAndProlong(player1.id, provider, game, true, undefined);
    } catch (e) {
        logger.info(e);
    }
    {
        const NAME = "Authorization of non-existing key";
        let error: Exception | null = null;
        try {
            await walletAdapter.authenticate("non_existing_key", operator, provider, game);
        } catch (e) {
            error = e as Exception;
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, error?.code === errorCodes["PLAYER_UNAUTHORIZED"], "error code should be 'PLAYER_UNAUTHORIZED'");
        }
    }

    {
        const NAME = "Authorization of wrong hmac secret key";
        let error: Exception | null = null;
        try {
            walletAdapter.config.secretKey = incorrectKey;
            await walletAdapter.authenticate(key, operator, provider, game);
        } catch (e) {
            error = e as Exception;
        } finally {
            walletAdapter.config.secretKey = correctKey;
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, error?.code === errorCodes["SERVER_UNAUTHORIZED"], "error code should be 'SERVER_UNAUTHORIZED'");
        }
    }

    {
        const NAME = "Balance";
        let response: IWalletBalance | null = null;
        // let error: Error;
        try {
            response = await walletAdapter.balance(player1, provider, game, session1!);
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            balance = response?.balance;
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
        }
    }

    {
        const NAME = "Balance with wrong hmac secret key";
        let error: Exception | null = null;
        try {
            walletAdapter.config.secretKey = incorrectKey;
            await walletAdapter.balance(player1, provider, game, session1!);
        } catch (e) {
            error = e as Exception;
        } finally {
            walletAdapter.config.secretKey = correctKey;
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, error?.code === errorCodes["SERVER_UNAUTHORIZED"], "error code should be 'SERVER_UNAUTHORIZED'");
        }
    }

    {
        const NAME = "Withdraw transaction";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_withdraw",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round",
                    amount: 4.56,
                    provider,
                    roundFinished: false,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = round((balance || 0) - 4.56);
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should be reduced by '4.56' to " + balance);
        }
    }

    {
        const NAME = "Withdraw transaction - idempotence";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_withdraw",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round",
                    amount: 4.56,
                    provider,
                    roundFinished: false,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, response?.balance === balance, "transaction with existing 'transactionId' should be skipped and balance returned");
        }
    }

    {
        const NAME = "Deposit transaction";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_deposit",
                    game,
                    type: "deposit",
                    roundId: roundIdPrefix + "_round",
                    amount: 1.23,
                    provider,
                    roundFinished: true,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = round(balance + 1.23);
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should be increased by '1.23' to " + balance);
        }
    }

    {
        const NAME = "Deposit transaction - idempotence";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_deposit",
                    game,
                    type: "deposit",
                    roundId: roundIdPrefix + "_round",
                    amount: 1.23,
                    provider,
                    roundFinished: true,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, response?.balance === balance, "transaction with existing 'transactionId' should be skipped and balance returned");
        }
    }

    {
        const NAME = "Withdraw transaction - insufficient funds";
        let error: Exception | null = null;
        try {
            await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_insufficient",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round_insufficient",
                    amount: balance + 1,
                    provider,
                    roundFinished: false,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            error = e as Exception;
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, error?.code === errorCodes["INSUFFICIENT_FUNDS"], "error code should be 'INSUFFICIENT_FUNDS'");
        }
    }

    {
        const NAME = "Withdraw transaction with wrong hmac secret key";
        let error: Exception | null = null;
        try {
            walletAdapter.config.secretKey = incorrectKey;
            await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_e",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round",
                    amount: 1,
                    provider,
                    roundFinished: false,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            error = e as Exception;
        } finally {
            walletAdapter.config.secretKey = correctKey;
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, error?.code === errorCodes["SERVER_UNAUTHORIZED"], "error code should be 'SERVER_UNAUTHORIZED'");
        }
    }

    {
        const NAME = "Withdraw transaction to be cancelled";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_cancel",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round_cancel",
                    amount: 10,
                    provider,
                    roundFinished: false,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = round(balance - 10);
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should be decreased by '10' to " + balance);
        }
    }

    {
        const NAME = "Cancel withdrawal transaction";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.cancel(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_cancel",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round_cancel",
                    amount: 10,
                    provider,
                    roundFinished: false,
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = round(balance + 10);
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should be increased by '10' to " + balance);
        }
    }

    {
        const NAME = "Cancel non-existing transaction";
        // let error: Error;
        let response: IWalletBalance | null = null;
        let error: Exception | null = null;
        try {
            response = await walletAdapter.cancel(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "non_existing_cancel",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "non_existing_round_cancel",
                    amount: 10,
                    provider,
                    roundFinished: false,
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
            error = e as Exception;
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, typeof response === "object", "response should be json object");
            test(NAME, typeof response?.balance === "number" || error?.code === errorCodes["TRANSACTION_NOT_FOUND"], "balance field should be a float or error TRANSACTION_NOT_FOUND");
        }
    }

    {
        const NAME = "Cancel transaction with wrong hmac secret key";
        let error: Exception | null = null;
        try {
            walletAdapter.config.secretKey = incorrectKey;
            await walletAdapter.cancel(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_cancel",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round_cancel",
                    amount: 10,
                    provider,
                    roundFinished: false,
                },
                session1!,
            );
        } catch (e) {
            error = e as Exception;
        } finally {
            walletAdapter.config.secretKey = correctKey;
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, error?.code === errorCodes["SERVER_UNAUTHORIZED"], "error code should be 'SERVER_UNAUTHORIZED'");
        }
    }

    {
        const NAME = "Deposit transaction after round was finished";
        let error: Exception | null = null;
        try {
            await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_deposit_after_finished",
                    game,
                    type: "deposit",
                    roundId: roundIdPrefix + "_round",
                    amount: 1.23,
                    provider,
                    roundFinished: true,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            error = e as Exception;
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, error?.code === errorCodes["UNKNOWN"], "error code should be 'UNKNOWN'");
        }
    }

    {
        const NAME = "Withdrawal transaction (free bet)";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_freeBet",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_freeBet",
                    amount: 1.23,
                    provider,
                    roundFinished: false,
                    campaignType: "freeBets",
                    campaignId: v4(),
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should not change");
        }
    }

    {
        const NAME = "Promo cash prize payout";
        // let error: Exception | null = null;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    provider,
                    transactionId: transactionIdPrefix + "_cash_prize",
                    type: "deposit",
                    amount: 100,
                    campaignId: "test",
                    campaignType: "test",
                    category: "promo",
                    roundId: v4(),
                    roundFinished: true,
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = round(balance + 100);
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should be increased by '100' to " + balance);
        }
    }

    {
        const NAME = "Successful authorization (session 2)";
        let response: IWalletAuthenticate | null = null;
        // let error: Error;
        try {
            response = await walletAdapter.authenticate(key2 || "", operator, provider, game2 || "");
            const {nativeId, token, currency, brand, country, nickname, gender, jurisdiction} = response;
            player2 = await Player.getOrCreate(nativeId, wallet, operator, {currency, brand, country, nickname, gender, jurisdiction});
            await Session.init(player2.id, token!, key2!, provider, game2!);
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = response?.balance;
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.nativeId === "string", "nativeId field should be a string");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, typeof response?.token === "string", "token field should be a string");
            test(NAME, typeof response?.currency === "string" && response?.currency === response?.currency.toLowerCase(), "currency field should be a lowercase string");
            test(NAME, typeof response?.brand === "string", "brand field should be a string");
            test(NAME, !!response && (!response.nickname || typeof response?.nickname === "string"), "nickname field should be a string or empty");
            test(NAME, !!response && (!response.country || (typeof response?.country === "string" && response.country === response.country.toLocaleLowerCase())), "country field should be a lowercase string or empty");
            test(NAME, !!response && (!response.gender || ["m", "f"].indexOf(response.gender) >= 0), "gender field should be a 'm', 'f' or empty");
            test(
                NAME,
                !!response && (!response.jurisdiction || (typeof response?.jurisdiction === "string" && response.jurisdiction === response.jurisdiction.toLocaleLowerCase())),
                "jurisdiction field should be a lowercase string or empty",
            );
            test(NAME, response?.nativeId === player1.nativeId, "session 2 should be from the same player as session 1");
            test(NAME, game !== game2, "session 2 should be on different game than session 1");
        }
    }

    try {
        session2 = await Session.getAndProlong(player2.id, provider, game2, true, undefined);
    } catch (e) {
        logger.info(e);
    }
    {
        const NAME = "Withdraw transaction (session 2)";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player2,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_withdraw_session2",
                    game: game2,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round_session2",
                    amount: 4.56,
                    provider,
                    roundFinished: false,
                    category: "normal",
                },
                session2!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = round((balance || 0) - 4.56);
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should be reduced by '4.56' to " + balance);
        }
    }

    {
        const NAME = "Withdraw transaction (session 1)";
        // let error: Error;
        let response: IWalletBalance | null = null;
        try {
            response = await walletAdapter.transaction(
                player1,
                {
                    ...baseWalletTransaction,
                    transactionId: transactionIdPrefix + "_withdraw_session1",
                    game,
                    type: "withdraw",
                    roundId: roundIdPrefix + "_round_session1",
                    amount: 4.56,
                    provider,
                    roundFinished: false,
                    category: "normal",
                },
                session1!,
            );
        } catch (e) {
            logger.warn("Wallet Verifier error: " + NAME, e);
        } finally {
            requests[NAME] = Object.assign({}, walletAdapter.__debug);
            walletAdapter.__debug = null;
            balance = round((balance || 0) - 4.56);
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.balance === "number", "balance field should be a float");
            test(NAME, response?.balance === balance, "balance should be reduced by '4.56' to " + balance);
        }
    }

    const passed = tests.filter(test => test.passed).length;
    const failed = tests.filter(test => !test.passed).length;

    for (const name in requests) {
        const {url, body, headers, method, status, responseHeaders, text} = requests[name];
        requests[name] = {url, body, headers, method, status, responseHeaders, text};
    }

    const grouped: any = {};
    for (const test of tests) {
        grouped[test.name] = grouped[test.name] || {assertions: [], request: null, name: test.name};
        grouped[test.name].assertions.push({passed: test.passed, message: test.message});
        grouped[test.name].request = requests[test.name];
    }
    return {summary: {passed, failed}, tests: Object.values(grouped)};
}

import fetch from "@slotify/shared/lib/fetch";
import logger from "@slotify/shared/lib/logger";
import {gamesService} from "../util/gamesUtil";
import {Response} from "@slotify/shared/lib/fetch";

interface IRequestDebug {
    url: string;
    method: string;
    body: string | undefined;
    headers: any;
    status?: number;
    text?: string;
    responseHeaders?: any;
}

function randomElement(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export default async function gameVerifier(
    provider: string,
    game: string,
    variant: string = "",
    iterations: number = 1,
    definedAction: string | null = null,
    definedBet: number | null = null,
    definedInitialParams: string | null = null,
    criticalFilePath: string,
) {
    const requests: Record<string, IRequestDebug> = {};

    const fetchFromGame = async (NAME: string, url: string, method: string, body: any | undefined, parseJson: boolean = true) => {
        let r: Response;
        let text: string = "";
        const headers = {"Content-Type": "application/json"};
        body = body ? JSON.stringify(body) : undefined;
        try {
            requests[NAME] = {url, body, headers, method};
            r = await fetch(`${await gamesService(provider, game)}${url}`, {method, headers, body});
            text = await r.text();
        } catch {
            logger.warn("Game Verifier request error ");
        } finally {
            const status = r!.status;
            const responseHeaders = r!.headers;
            requests[NAME] = {...requests[NAME], status, responseHeaders, text};
        }
        return parseJson ? JSON.parse(text) : text;
    };

    const tests: {name: string; passed: boolean; message: string}[] = [];
    const test = (name: string, passed: boolean, message: string) => {
        // if (!onlyFailed || !passed) {
        tests.push({name, passed: Boolean(passed), message});
        // }
    };

    let bets: any = {};

    {
        const NAME = "Health check";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/health`, "GET", undefined, false);
        } catch {
            logger.warn("Game Verifier error: " + NAME);
        } finally {
            test(NAME, response === "OK", "response should be plain text 'OK'");
        }
    }

    {
        const NAME = "Critical file checksum";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/api/criticalFileChecksum?criticalFilePath=${criticalFilePath}`, "GET", undefined, true);
        } catch {
            logger.warn("Game Verifier error: " + NAME);
        } finally {
            test(NAME, response && typeof response.checksum === "string", "critical files endpoint needs to return a checksum");
        }
    }

    {
        const NAME = "Error";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/non-existing-path`, "GET", undefined);
        } catch {
            //         // error = e;
        } finally {
            test(NAME, typeof response?.error === "object", "response should contain error object");
            test(NAME, typeof response?.error?.message === "string", "response should contain error message");
            test(NAME, typeof response?.error?.code === "string", "response should contain error code");
        }
    }

    {
        const NAME = "Games";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/api/games`, "GET", undefined);
        } catch {
            logger.warn("Game Verifier error: " + NAME);
        } finally {
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(
                NAME,
                Object.values(response || {}).every((games: any) => Array.isArray(games) && games.every((bet: any) => typeof bet === "string")),
                "List of games should be array of strings",
            );
        }
    }

    {
        const NAME = "Config";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/api/games/${game}/config?variant=${variant}`, "GET", undefined);
        } catch {
            logger.warn("Game Verifier error: " + NAME);
        } finally {
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
        }
    }

    {
        const NAME = "Bets";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/api/games/${game}/bets?variant=${variant || ""}`, "GET", undefined);
        } catch {
            logger.warn("Game Verifier error: " + NAME);
        } finally {
            bets = response?.bets || {};
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.bets === "object", "response should be have top-level 'bets' field");
            // test(NAME, Object.keys(response).every(action => Object.keys(bets).includes(action)), "Cheats should be divided per actions");
            test(
                NAME,
                Object.values(response?.bets || {}).every(
                    (action: any) =>
                        (Array.isArray(action.available) && action.available.every((bet: any) => typeof bet === "number")) ||
                        (typeof action.available === "object" && typeof action.available.min === "number" && typeof action.available.max === "number" && typeof action.available.step === "number"),
                ),
                "Each action should contain `available` bets (array of numbers or {min, max, step} range)",
            );
            test(
                NAME,
                Object.values(response?.bets || {}).every((action: any) => typeof action.default === "number"),
                "Each action should contain `default` bet",
            );
            test(
                NAME,
                Object.values(response?.bets || {}).every((action: any) => typeof action.maxWin === "number"),
                "Each action should contain `maxWin`",
            );
            test(
                NAME,
                Object.values(response?.bets || {}).every((action: any) => typeof action.coin === "number"),
                "Each action should contain `coin`",
            );
        }
    }

    {
        const NAME = "Cheats";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/api/games/${game}/cheats`, "GET", undefined);
        } catch {
            logger.warn("Game Verifier error: " + NAME);
        } finally {
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(
                NAME,
                Object.keys(response || {}).every(action => Object.keys(bets).includes(action)),
                "Cheats should be divided per actions",
            );
            test(
                NAME,
                Object.values(response || {}).every(cheats => Array.isArray(cheats) && cheats.every(cheat => typeof cheat === "string")),
                "Cheats per action should be an array of strings",
            );
        }
    }

    {
        const NAME = "Validate (OPTIONAL)";
        let response: any;
        try {
            response = await fetchFromGame(NAME, `/api/games/${game}/validate`, "POST", {action: "myAction", bet: 1, coin: 1, betLimits: {minBet: 1, maxBet: 100, maxBonusBet: 1000, maxExposure: 10000, currencyRate: 1}});
        } catch {
            logger.warn("Game Verifier error: " + NAME);
        } finally {
            test(NAME, typeof response === "object", "response should be json object without 'error' field");
            test(NAME, typeof response?.valid === "boolean", "response should contain boolean 'valid' field");
            test(NAME, response?.valid !== true, "Validate should not return 'true' by default ");
        }
    }

    {
        const NAME = `Play & action`;
        let response: any;
        let actionResponse: any;
        let state = null;
        let totalBet = 0;
        let totalWin = 0;

        for (let i = 0; i < iterations; i++) {
            if (Object.keys(bets).length === 0) break;
            let action = definedAction || randomElement(Object.keys(bets));
            let params = definedInitialParams ? JSON.parse(definedInitialParams) : null;
            const bet = definedBet || (Array.isArray(bets[action!].available) ? randomElement(bets[action!].available) : bets[action!].available.max);
            const coin = bets[action!].coin;
            totalBet += bet!;
            let step = 0;
            do {
                step++;
                const PLAY_NAME = `Play (iteration ${i + 1}/${iterations}, step ${step})`;
                const ACTION_NAME = `Action (iteration ${i + 1}/${iterations}, step ${step})`;
                try {
                    response = await fetchFromGame(PLAY_NAME, `/api/games/${game}/play`, "POST", {
                        state,
                        bet,
                        action,
                        params,
                        variant,
                        coin,
                    });
                } catch {
                    logger.warn("Game Verifier error: " + PLAY_NAME);
                } finally {
                    test(PLAY_NAME, typeof response === "object", "response should be json object without 'error' field");
                    test(PLAY_NAME, typeof response?.win === "number", "response should contain win");
                }
                state = response?.state;
                totalWin += response?.win;

                if (response?.next && response.next.length > 0) {
                    try {
                        actionResponse = await fetchFromGame(ACTION_NAME, `/api/games/${game}/action`, "POST", {
                            state,
                            bet,
                            action,
                            variant,
                            coin,
                            ...response,
                        });
                    } catch {
                        logger.warn("Game Verifier error: " + ACTION_NAME);
                    } finally {
                        test(ACTION_NAME, typeof actionResponse === "object", "response should be json object without 'error' field");
                        test(ACTION_NAME, typeof actionResponse?.action === "string", "action should be string");
                        test(ACTION_NAME, response?.next.includes(actionResponse?.action), "action should be included in 'next' field from previous play");
                    }
                    action = actionResponse?.action;
                    params = actionResponse?.params;
                }
            } while (response?.next && response.next.length > 0);
            action = null;
        }

        const rtp = totalWin / totalBet;
        const SIMULATION_NAME = `${NAME} simulation (${iterations} iterations)`;
        test(SIMULATION_NAME, rtp < 1, `RTP should be below 100% (It was ${(rtp * 100).toFixed(2)})%`);
        test(SIMULATION_NAME, rtp > 0, `RTP should be above 0% (It was ${(rtp * 100).toFixed(2)})%`);
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

import http from "k6/http";
import {sleep} from "k6";
import {Counter} from "k6/metrics";
import {htmlReport} from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import {textSummary} from "https://jslib.k6.io/k6-summary/0.0.1/index.js";


const sleepTime = 1;

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}


export const options = {
    stages: [
        // {duration: "1m", target: 1},
        {duration: "0m", target: 1},
        // {duration: "30m", target: 60},
        {duration: "10m", target: 1},
        // {duration: "20m", target: 130},
        // {duration: "10m", target: 40},
        // {duration: "30m", target: 200},
        // {duration: "30m", target: 200},
    ],
};

const plays = new Counter("play_requests");
const spins = new Counter("spins");

export default function () {
    const url = __ENV.URL || "https://test.tequity.ventures";
    const operator = "37849";
    const wallet = "TCS";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1YTZiNDhlMy1hODU3LTQ1NjEtOGRjMS01NTQ5ZDBhMGY4ZDIiLCJpYXQiOjE3NDQxOTg4MjEsInJlcXVlc3QiOiJ7XCJpZGVudGlmaWVyc1wiOntcImxhbmd1YWdlQ29kZVwiOlwiZW4tdXNcIixcInByb2R1Y3RJZFwiOjM3ODQ5LFwiZXh0ZXJuYWxQcm9kdWN0SWRcIjo5OSxcInNpdGVcIjpcIlRDU1wifSxcImhvbWVVcmxcIjpcImJiYlwiLFwiYmFua2luZ1VybFwiOlwieHh4XCIsXCJjcmVkZW50aWFsc1wiOntcInRva2VuVHlwZVwiOjEsXCJ0b2tlblwiOlwiZXlKMGVYQWlPaUpLVjFRaUxDSmhiR2NpT2lKU1V6STFOaUo5LmV5SnBjM01pT2lKb2RIUndjem92TDJGalkyOTFiblF2ZGpFaUxDSmphV1FpT2lJek56ZzBPU0lzSW1wMGFTSTZJaTAyTkRRd01UWTNNalkzTnpJM05URXhOVFl6SWl3aWIzVnBaQ0k2SWpCNE1VWXdNREF3SWl3aWMzVmlJam9pTkdZMk1ESmpNVGt4T0RRek5EVmhZVGsyTjJRMFkyUTFOMkV4WWpWaFlXVWlMQ0pqWlhKMElqb2liV2R6TG5WelpYSnpaWE56YVc5dWRHOXJaVzR1ZEdOekxqSXdNalF3TVRFM0xqSXdORGhpYVhRaUxDSnBZWFFpT2lJeE56UTBNVGs0T0RFNElpd2lZWFZrSWpvaVNtOXBibFZ6WlhKVFpYTnphVzl1SW4wLkxMeUo0QThLTC1mblpCU2FTOXdiWnN1OFJiOGR1T2Z2N0lnenBudGlLRkpKYU1XZ1dPeEJ1UXpodlFrbU50VEo3RkE3WXprajVLZC13eE9CYVQwMGUyV3gtMmRBQ3Ruam9ibGU4ZFhaYWdkY3EtZ2dnTHlLYTVFNmxza3ZyeWprS20tLWJPS0g3aXpNN1VSU3ZyUWxleG1ydURTeDdJaE9MRktUb2Z1WU01VXFZSE1lUXJfd19EUnRXdTB4TDllTjVFVS1WdkUxbk9BeTR3Rl9wSFR6UDhfcFBWb08xNjJzaWVTTV90WmZkU1VoaFhjMFZuQWZIVk5za19lNnZIOHhpd3dXOW1NVDZ4SVJ5d1MzVmxxOElNYjBDS0NYYTFoU3FENEdkME9tcEhCZlNfNFd0VlUzMmFtUUlnM2Zlc2JqRG1hNVhpV2RnSWtLNWVrOVM5NmNpd1wifSxcImludGVudFwiOjEsXCJnYW1lXCI6XCJ3aWxkLW9uZVwiLFwiYmV0Q29uZmlnXCI6e1wibWF4RXhwb3N1cmVcIjo4NTAwMDAwLjAsXCJtaW5CZXRcIjo1LjAsXCJkZWZhdWx0QmV0XCI6MjUuMH19IiwibmJmIjoxNzQ0MTk4ODIxLCJleHAiOjE3NDQyMDA2MjEsImlzcyI6Imh0dHBzOi8vZXRpYWRhcHRvci90ZXEiLCJhdWQiOiJodHRwczovL2V0aWFkYXB0b3IvdGVxL2xhdW5jaCJ9.qWYHFm3uf5E2lLfo6ljm2F4gKVHjQLZjKBAYfd6Zh0w";//"load-test-" + Math.round(Math.random() * Math.pow(10, 17)) + ":1000000:eur";
    const providers = http.get(url + "/games",
        JSON.stringify({wallet, operator, key}),
        {headers: {"Content-Type": "application/json"}}
    );
    const provider = "peterandsons";//randomElement(Object.keys(parse(providers)));
    const game = "wild-one";//randomElement(parse(providers)[provider]);

    const auth = http.post(url + "/authenticate",
        JSON.stringify({wallet, operator, key, provider, game}),
        {headers: {"Content-Type": "application/json"}}
    );
    const {token} = parse(auth, {"/authenticate has correct balance": (data) => typeof data.balance === "number"});

    const info = http.get(url + "/game/info?game=" + game + "&provider=" + provider,
        {headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}}
    );
    const bets = parse(info, {
        "/game/info includes at least one action bet": (r) => Object.keys(r.bets).length > 0,
    }).bets;
    const actions = Object.keys(bets);

    sleep(sleepTime);

    // const campaigns = http.get(url + "/campaigns?game=" + game + "&provider=" + provider,
    //     {headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}}
    // );
    // const allCampaigns = parse(campaigns, {
    //     "/campaigns includes campaigns": (r) => r.campaigns !== undefined,
    // }).campaigns;


    // for (const campaign of allCampaigns) {
    //     if (campaign.status === "started") {
    //         http.post(url + "/campaigns/" + campaign.campaignId + "/opt",
    //             JSON.stringify({provider, game, optIn: true}),
    //             {headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}},
    //         );
    //     }
    // }

    for (let i = 0; i < 100; i++) {
        const action = randomElement(actions);
        const bet = randomElement(bets[action].available);
        const play = http.post(url + "/game/play",
            JSON.stringify({bet, action, game, provider}),
            {headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}}
        );
        plays.add(1);
        const {roundId, wager} = parse(play, {"/game/play contains wager object": (data) => typeof data.wager === "object"});
        let next = wager.next;

        sleep(sleepTime);

        while (next && next.length > 0) {
            const action = randomElement(next);
            const play = http.post(url + "/game/play",
                JSON.stringify({bet: 0, action, game, provider, roundId}),
                {headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}}
            );
            next = parse(play, {}).wager.next;
            plays.add(1);
            sleep(sleepTime);
        }

        const complete = http.post(url + "/game/complete",
            JSON.stringify({roundId, game, provider}),
            {headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}}
        );
        parse(complete, {"/game/complete has correct balance": (data) => typeof data.balance === "number"});

        spins.add(1);
    }
}

function parse(res, checks) {
    let json;
    const time = new Date().toLocaleTimeString();
    try {
        json = JSON.parse(res.body);
    } catch (e) {
        throw new Error(time + " FAILED: parsing json. " + res.status + " " + res.status_text + " " + res.url/* + " "+ res.body*/);
    }
    for (const name in checks) {
        if (!checks[name](json)) {
            throw new Error(time + " FAILED: " + name + res.body);
        }
    }
    return json;
}

export function handleSummary(data) {
    return {
        stdout: textSummary(data, {indent: " ", enableColors: true}),
        "summary.html": htmlReport(data),
    };
}
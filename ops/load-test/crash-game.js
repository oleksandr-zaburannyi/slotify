import http from "k6/http";
import {check, sleep} from "k6";
import ws from "k6/ws";
import exec from "k6/execution";
import {Counter} from "k6/metrics";
import {htmlReport} from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import {textSummary} from "https://jslib.k6.io/k6-summary/0.0.1/index.js";


const sleepTime = 1;

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min, max, decimalPlaces) {
    const factor = Math.pow(10, decimalPlaces);
    const random = Math.random() * (max - min) + min;
    return Math.round(random * factor) / factor;
}

export const options = {
    stages: [
        {duration: "0m", target: 10},
        {duration: "15m", target: 1000},
        // {duration: "15m", target: 100},
        // {duration: "15m", target: 1000},
        // {duration: "0m", target: 5},
        // {duration: "30m", target: 60},
        // {duration: "10m", target: 60},
        // {duration: "20m", target: 130},
        // {duration: "10m", target: 40},
        // {duration: "30m", target: 200},
        // {duration: "30m", target: 200},
    ],
};

const numberOfBets = new Counter("bets");
const numberOfConnected = new Counter("connected");

export default function () {
    // const url = "http://localhost:8081";
    const url = "https://test.tequity.ventures";
    const operator = "demo";
    const wallet = "demo";
    const key = "load-test-" + Math.round(Math.random() * Math.pow(10, 17)) + ":1000000:eur";
    const providers = http.get(url + "/games",
        JSON.stringify({wallet, operator, key}),
        {headers: {"Content-Type": "application/json"}}
    );
    const provider = "test-provider";
    const game = "crash-game";

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

    const rooms = http.get(url + "/game/rooms?game=" + game + "&provider=" + provider,
        {headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}}
    );
    const channel = parse(rooms, {
        "/room should return at least one room": (r) => r.rooms.length > 0,
    }).rooms[0].roomId;

    // const websocketUrl = "ws://localhost:8087" + "/websocket/multiplayer?token=" + token + "&channel=" + channel;
    const websocketUrl = url.replace("http", "ws") + "/websocket/multiplayer?token=" + token + "&channel=" + channel;
    const res = ws.connect(websocketUrl, {timeout: 60 * 60 * 1000}, function (socket) {
        const sendMessage = (type, payload) => {
            socket.send(JSON.stringify({type, payload}));
        }
        socket.on("open", () => {
            numberOfConnected.add(1);
            // console.log("connected")
        });
        let sendBet = false;
        socket.on("message", (data) => {
            const {type, payload} = JSON.parse(data);
            if (type === "broadcast" && payload.status === "crash") {
                sendBet = true;
            } else if (type === "message" && payload.confirmedPlayerBet) {
                // console.info("bet confirmed")
            } else if (type === "message" && payload.cancelledPlayerBet) {
                // console.info("bet cancelled")
            } else if (payload.status === "flying") {
            } else if (type === "balance") {
            } else if (payload.status === "awaitingLaunch") {
                if (sendBet) {
                    numberOfBets.add(1);
                    // console.info("bet: " + "load-test-player-" + exec.vu.idInInstance)
                    sendMessage("command", {action: "main", bet: 1, params: {multiplier: getRandomNumber(1, 5, 2), nickname: "load-test-player-" + exec.vu.idInInstance}});
                }
                sendBet = false;
            } else if (payload && payload.ejectedPlayers && payload.ejectedPlayers.length > 0) {
                // console.info("ejected", payload.ejectedPlayers.length)
            } else {
                // console.info("unknown", type, payload);
            }
        });
        // socket.on("close", () => console.log("disconnected"));
        // socket.on("error", function (e) {
        // if (e.error() !== "websocket: close sent") {
        // console.log("An unexpected error occured: ", e.error());
        //     }
        // });
    });

    check(res, {"status is 101": (r) => r && r.status === 101});
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
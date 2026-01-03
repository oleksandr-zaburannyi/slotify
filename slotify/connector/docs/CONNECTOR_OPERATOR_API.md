# Connector Operator API

## Introduction

This document describes API exposed by _Connector_ to the _Operator_.

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHALL`, `SHALL NOT`, `SHOULD`, `SHOULD NOT`, `RECOMMENDED`,  `MAY`,
and `OPTIONAL` in this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

## Outgoing messages

Messages sent from the game client to the iframe parent via [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

Example of sending message:

```javascript
window.addEventListener("message", (event) => {
    const {message, data} = event.data;
    switch (message) {
        case "reload":
            window.location.reload();
            break;
    }
});
```

| Message         | Data                                    | Description                                                                                                          |
|-----------------|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| `authenticated` | {balance, token, currency, sessionData} | Game has authenticated player                                                                                        |
| `started`       | -                                       | Game has started (i.e. slot started spinning)                                                                        |
| `stopped`       | -                                       | Game has stopped (i.e. slot stopped spinning)                                                                        |
| `balance`       | `{balance: 100}`                        | Balance changed                                                                                                      |
| `exit`          | -                                       | Quit the game and i.e. return to the lobby To activate it requires passing `&customExit` flag in the game launch URL |
| `reload`        | -                                       | Reload the game. To activate it requires passing `&customReload` flag in the game launch URL                         |
| `deposit`       | -                                       | Display deposit popup To activate it requires passing `&customDeposit` flag in the game launch URL                   |
| `betChanged`    | {bet}                                   | `setActiveBet` method was called by the game client                                                                  |
| `replayShown`   | replay                                  | Replay presentation was started, ie. `show` method was called from Game History list                                 |
| `replayHidden`  | -                                       | Player stopped replay screen presentation, ie. `show` method was called from Game History list                       |

## Incoming messages

Messages sent from iframe parent to the game client via [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

Example of sending message:

```javascript
const iframe = document.getElementById("iframe").contentWindow;
iframe.postMessage({message: "freeze", data: {test: 123}}, "*");
```

| Message          | Data                                       | Description                                                         |
|------------------|--------------------------------------------|---------------------------------------------------------------------|
| `freeze`         | -                                          | Shows overlay blocking the game interactivity and stopping autoplay |
| `unfreeze`       | -                                          | Hides overlay blocking the game interactivity                       |
| `mute`           | -                                          | Mutes audio                                                         |
| `unmute`         | -                                          | Unmutes audio                                                       |
| `play`           | `{action: "main", bet: 2, cheat: "bonus"}` | Triggers the game                                                   |
| `stopAutoplay`   | -                                          | Stops autoplay (without the overlay)                                |
| `balanceChanged` | `{balance: 1000}`                          | Updates balance in the game to the specific amount                  |
| `refreshBalance` | -                                          | Triggers an async balance update in the game                        |

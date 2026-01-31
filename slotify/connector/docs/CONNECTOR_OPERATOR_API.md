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

| Message           | Data                                      | Description                                                                                       |
|-------------------|-------------------------------------------|---------------------------------------------------------------------------------------------------|
| `authenticated`   | `{balance, token, currency, sessionData}` | Game has authenticated player                                                                     |
| `gameLoaded`      | `{progress}`                              | Game has finished loading. Progress is 0-100                                                      |
| `started`         | -                                         | Game has started (i.e. slot started spinning)                                                     |
| `wager`           | `{wager, balance, roundId}`               | Wager was placed                                                                                  |
| `stopped`         | `{roundId, balance, finalWin}`            | Game has stopped (i.e. slot stopped spinning). `finalWin` is present when round is completed      |
| `recovered`       | `{roundId, wagers}`                       | Game round was recovered from incomplete state                                                    |
| `balance`         | `{balance}`                               | Balance changed                                                                                   |
| `exit`            | `{lobbyUrl}`                              | Quit the game and return to the lobby. Requires passing `&customExit` flag in the game launch URL |
| `reload`          | -                                         | Reload the game. Requires passing `&customReload` flag in the game launch URL                     |
| `deposit`         | -                                         | Display deposit popup. Requires passing `&customDeposit` flag in the game launch URL              |
| `betChanged`      | `{bet}`                                   | `setActiveBet` method was called by the game client                                               |
| `muted`           | -                                         | Game audio was muted                                                                              |
| `unmuted`         | -                                         | Game audio was unmuted                                                                            |
| `turboToggled`    | `{value}`                                 | Turbo mode was toggled                                                                            |
| `autoplayToggled` | `{value}`                                 | Autoplay was toggled                                                                              |
| `paytableToggled` | `{value}`                                 | Paytable was toggled                                                                              |
| `helpToggled`     | `{value}`                                 | Help screen was toggled                                                                           |
| `aboutToggled`    | `{value}`                                 | About screen was toggled                                                                          |
| `replayShown`     | `replay`                                  | Replay presentation was started, i.e. `show` method was called from Game History list             |
| `replayHidden`    | -                                         | Player stopped replay screen presentation                                                         |

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
| `turboToggle`    | `{value: true}`                            | Toggle turbo mode on/off                                            |
| `paytableToggle` | `{value: true}`                            | Toggle paytable on/off                                              |
| `helpToggle`     | `{value: true}`                            | Toggle help screen on/off                                           |
| `aboutToggle`    | `{value: true}`                            | Toggle about screen on/off                                          |
| `play`           | `{action: "main", bet: 2, cheat: "bonus"}` | Triggers the game                                                   |
| `stopAutoplay`   | -                                          | Stops autoplay (without the overlay)                                |
| `balanceChanged` | `{balance: 1000}`                          | Updates balance in the game to the specific amount                  |
| `refreshBalance` | -                                          | Triggers an async balance update in the game                        |

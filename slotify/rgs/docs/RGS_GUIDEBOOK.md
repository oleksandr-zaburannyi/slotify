# Guidebook

Features:

- Compatible with any single player casino game genre and mechanics
- Multiplayer game support can be added on request
- Recovering and auto completing unfinished rounds
- Support for persistent game state and multistep games
- Multi currency bet and max exposure limit configurations
- Variable RTP
- Technology-agnostic towards Game Server
- It can connect to Game Servers written in any programming language
- Easy to integrate existing games catalogue
- Compliant with regulatory requirements through critical files verification system and RTP monitoring
- Game feed feature that allows for lightweight storage e.g. roulette's hot numbers

## Round

The round represent full game cycle and contains of one or many wagers.

### Round states

- `started` - the round has started
- `finished` - the round is successfully finished
- `unpaid` - the round is completed by player, but it was not finished succesfully
- `failed` - the round has failed and should be cancelled
- `cancelled` - the round has been cancelled

## Settings

Settings are set of key-value pairs to configure the system. Settings can be specified for particular wallet, operator, brand, provider, game and jurisdiction.

In case multiple rows with the same key are applied, the system will take the one with the highest `priority`.

### Filters

Let's consider the following settings:

| priority | key     | value      | wallets | providers | operators                | games       |
|----------|---------|------------|---------|-----------|--------------------------|-------------|
| 100      | `"key2` | `"value1"` | `null`  | `null`    | `["casinoA", "casinoB"]` | `["gameA"]` |
| 200      | `"key2` | `"value2"` | `null`  | `null`    | `["casinoB"]`            | `["gameA"]` |

If we have a player playing `gameA` on `casinoA` the system will return `value1` (only it fulfills criteria).

If we have a player playing on `casinoB` the system will return `value2` (both settings fulfill criteria, so it takes higher priority).

In we have a player playing `gameB` (regardless of casino) it will return `null` (no settings fulfil criteria)

### Settings visibility

Flag `serverOnly` specifies if the setting is visible only to the server or shared with the game client in `/info/` call.

### Predefined settings

Settings can handle any key but there are predefined keys associated with specific functionalities:

- `maxExposure` - specifies maximum exposure
- `minBet` - specifies minimum bet
- `maxBet` - specifies maximum bet
- `maxBonusBet` - specifies maximum bet for bets different then `"main"`
- `defaultBet` - specifies default bet. The system will select the closest value lower than specified value
- `gameVariant` - specifies game variant
- `mainBets` - (default: `"main"`) comma separated list of bet actions which are considered non-bonus (so `maxBonusBet` is not applicatble to) i.e. `"main,ante"`
- `availableBets` - list of available bets in base currency (overrides `available` array). Sample: `{"main": [0.2, 0.5, 1, 2.5, 10]}`
- `autoCompleteHours` - number of hours after which a first auto-complete process starts (default `24`)
- `autoCompleteDisabled` - if `"true"` auto complete will never be triggered automatically
- `depositRetries` & `cancelRetries` - comma separated retries intervals in minutes i.e. `1,5,10` will cause 1st retry in 1 minute, 2nd in 5min after 1st, 3rd and each following after 10 min after each
- `retriesExpiryHours` - number of hours after which an retries stop (by default it is `72` hours)
- `provablyFair` - if set to `"true"` value it will activate provably fair mode
- `maxDecimals` - limits maximum number of currency decimal places even if currency can support more (by default it is `2`)
- `parallelRounds` - if set to `"true"` enables opening multiple rounds in parallel (without waiting for previous to finish)
- `hidePromoOptOut` - if set to `"true"` removes "Opt out" button from campaign UI (`serverOnly` must be set to `false`)
- `closePromoOptOut` - if set to `"true"` "Opt out" button just closes the window without permanent opt out and popup comes up again after refresh  (`serverOnly` must be set to `false`)
- `gameEnabled` - if set value other than `"true"` makes the game disabled
- `hideCurrencySymbol` - hides currency symbol (displays just a value) for default currency formatter
- `defaultCampaignThemeName` - default campaign theme per type i.e. `{"freeBets": "my-theme"}`

## Fixed currency exchange rates

The platform comes with a system to conveniently and securely convert game bets to good-looking, human-readable values in different currencies e.g. 1eur = 10sek, 1eur = 5pln, 1eur=100jpy.

System populates this fixed rates during the initial deployment to the predefined values, adjusted to reflect market requirements for each currency.
These can be adjusted via Back Office at any time.

## Bet management

Based on available bets and theoretical maximum win (`maxWin`) specified in game server and values from settings the server calculate bets accepted by the system.

Available bets are expressed in environment's base currency (`process.env.BASE_CURRENCY`) and are used as the basis for bet conversions via the [Fixed Currency exchange rates system](#fixed-currency-exchange-rates).

Maximal potential win `maxWin` is expressed as a **multiple** of the initial bet (e.g., `maxWin: 1000` means player can win up to 1000 times the bet).

Each bet needs to fulfill the following criteria:

- `bet` is greater or equal then `minBet`
- `bet` is lower or equal then `maxBet`
- `bet` is lower or equal then `maxBonusBet` (only for bets different from `main`)
- `bet * maxWin` is lower than `maxExposure`

After that all bets are converted to player's currency using Fixed currency exchange rates.

### Example

**Settings**

| key            | value     |
|----------------|-----------|
| `"minBet`      | `"1"`     |
| `"maxBet`      | `"100"`   |
| `"maxBonusBet` | `"1000"`  |
| `"maxExposure` | `"10000"` |

**Game bets**

```javascript
const game = {
    bets: {
        "main": {available: [0.1, 1, 10, 50, 100], default: 1, maxWin: 1000, coin: 1},
        "bonus": {available: [10, 100, 1000, 5000], default: 100, maxWin: 50, coin: 100},
    },
}
```

`main` bet will accept `[1,10]` because:

- `0.1` rejected due to being lower then `minBet`
- `100` rejected due to being greater then `maxBet`
- `50` rejected due to being greater then `maxExposure/maxWin`

`bonus` bet will accept `[10, 100]` because:

- `5000` rejected due to being greater then `maxBonusBet`
- `1000` rejected due to being greater then `maxExposure/maxWin`

Assuming player is playing in `sek` currency with `1:10` ratio to base currency, bets player will see are:

- `main`: `[10, 100]`
- `bonus`: `[100, 1000]`

## Auto completion

If the round was interrupted because a player left before:

- seeing all animations
- making all necessary wagers to settle the round in multi-wager round

and has not returned within X hours (specified in Setting) to complete the round, there is an automatic process finishing those rounds. If there is player choice required (i.e. pick'n'click games) then the system will ask game server to
decide which action should be
selected.

## Critical files verification

Files certified as critical can be listed in Back Office along with their checksums.
System will be verifying if files exising on the servers match the declared checksum.

Checks are be executed:

- on system startup
- periodically every 12h
- per request from backoffice

Once a mismatch is detected system sends alert emails to support.
In case of repeated checksums verification failure (so in at most 24h), system blocks the server communication (if file is marked as "system blocking").

## RTP monitoring

Game (and Variant) RTP can be registered in the RTP monitoring system.
Platform will then track normalised expected value of the game algorithm in two weeks rolling window.

This values can be easily reviewed in the Back Office.
And in case RTP gets out of the (automatically calculated) 99.9% confidence interval, email alert will be sent to review game's performance.

## Game feed

Game's can store some lightweight data that's shared between all players playing a given game.
This feature can be used to implement Hot Number's feature. However, it cannot be used for critical game logic.

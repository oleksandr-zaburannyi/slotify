# RGS Integration

## Introduction

This document describes integration between _RGS_ (_Remote Game Server_) and an _Adapter_ via _seamless API_.

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHALL`, `SHALL NOT`, `SHOULD`, `SHOULD NOT`, `RECOMMENDED`,  `MAY`, and `OPTIONAL` in this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

## Set up information

The _RGS_ `SHOULD` provide:

- URLs to Game Client in normal and replay mode for staging and production environments.

The _RGS_ `SHOULD` be provided with:

- Endpoints for staging and production environments.
- IP addresses of production environment to whitelist.
- `HMAC` secret key.

## Integration

Prerequisites:

- Communication `SHOULD` be done via `HTTP/1.1` and encrypted with `SSL/TLS`.
- All API requests `MUST` be passed with `Content-Type: application/json`.
- All API responses `MUST` be passed with `Content-Type: application/json`.
- Any additional response or request data, parameters, fields or codes not described in documentation `SHOULD NOT` be used.
- Character encoding utf-8 `SHOULD` be set to `UTF-8`
- All time and date fields `SHOULD` be in `UTC` timezone

### Authorization

Authorization `MUST` be done using the following headers:

- `X-Server-Authorization`: _Server's_ authorization with `HMAC` scheme using `sha256` algorithm and request payload. Example of generating header: `crypto.createHmac("sha256", SECRET_KEY).update(BODY).digest("hex");` If body is empty then
  use empty object `{}` to hash.

The _Integration Module_ `MUST` check and validate headers and return error in case of incorrect authorization data.

### Response codes

All responses `MUST` return appropriate response's codes.

| Code  | Status            |
|-------|-------------------|
| `2XX` | Successful        |
| `4XX` | Application Error |
| `5XX` | Server Error      |

### Errors

All errors `MUST` follow unified structure. Field `message` should contain reason of the error, and it is logged by the _Server_ only internally and not passed to the _Game Client_, so it can be more descriptive than error messages from the
next section.

#### Example

```json
{
    "error": {
        "message": "Token expired",
        "code": "PLAYER_UNAUTHORIZED"
    }
}
```

#### Error codes

Field `code` `SHOULD` be mapped into the following message before passing to the _Game Client_

| Code                    | Description                                                      |
|-------------------------|------------------------------------------------------------------|
| `PLAYER_UNAUTHORIZED`   | `Couldn't authorize the player (Authorization header missmatch)` |
| `SERVER_UNAUTHORIZED`   | `Couldn't authorize the server`                                  |
| `INSUFFICIENT_FUNDS`    | `Not enough money to make withdrawal`                            |
| `TRANSACTION_NOT_FOUND` | `Transaction you are trying to cancel doesn't exist`             |
| `LOSS_LIMIT`            | `Loss limit has been exceeded`                                   |
| `TRANSACTION_FAILED`    | `Transaction was not processed`                                  |
| `UNKNOWN`               | `Unknown error`                                                  |

### Idempotence

In case of error, network failure or other reasons selected requests `MAY` be repeated therefore selected requests `MUST` be [idempotent](https://restfulapi.net/idempotent-rest-apis/) and return the same outcome.

## Flow

![flow](flow.png)

### Retries

Our platform handles immediate retries so preferably _RGS_ doesn't have to retry unless there's a network/communication error.
_RGS_ should support periodic retries of failed deposits and cancels (i.e. every hour).

## Launcher

_RGS_ needs to deliver three URLs:

- `realUrl` - launches game in real money mode redirected from `{serverUrl}/launch/real/?...`
- `funUrl` - launches game in fun mode redirected from `{serverUrl}/launch/fun/?...`
- `replayUrl` - launches replay in the Back Office redirected from `{serverUrl}/launch/replay/?...`

### Sample configuration:

```json
{
    "realUrl": "https://example.com/real?gameID=${game}",
    "funUrl": "https://example.com/fun?gameID=${game}",
    "replayUrl": "https://example.com/replay?gameID=${game}&roundID=${roundId}"
}
```

Depending on the mode we redirect to configured URL and replace `${x}` parameters with corresponding values so you can potentially fit your own launcher format.
<br/>If a variable is not defined explicitly with `${x}`, it is appended as querystring (so `https://example.com/real?game=${game}` and https://example.com/real" would both redirect to the same URL).
For multi-domain support provided url templates might contain `${hostname}` so player gets redirected to the same hostname as `launch` request. 
E.g. `https://cdn-${hostname}/real?game=${game}&server=https://${hostname}` will allow the operator to redirect players to environments with different domains depending on availability (e.g. `example.com`, `example2.com`).

### Parameters

**`real` and `fun` modes**

| Name         | Required                                                 | Example              | Description                                                                                                           |
|--------------|----------------------------------------------------------|----------------------|-----------------------------------------------------------------------------------------------------------------------|
| `wallet`     | `REQUIRED`                                               | `myWallet`           | _Wallet_ Id.                                                                                                          |
| `operator`   | `REQUIRED`                                               | `myOperator`         | _Operator_ Id                                                                                                         |
| `game`       | `REQUIRED`                                               | `myGame`             | _Game_ Id                                                                                                             |
| `key`        | `OPTIONAL` in `fun` mode, <br/>`REQUIRED` in `real` mode | `dnsa89me329jdos`    | _Operator's_ session initialisation key which `SHOULD` be active only once after generation and expire after `4 hour` |
| `language`   | `OPTIONAL`                                               | `en`                 | _Player's_ language code in [ISO 639-1](https://www.loc.gov/standards/iso639-2/php/code_list.php) format              |
| `lobbyUrl`   | `OPTIONAL`                                               | `http://lobby.url`   | URL to _Operator's_ lobby                                                                                             |
| `depositUrl` | `OPTIONAL`                                               | `http://deposit.url` | URL to _Operator's_ in-game deposit web page                                                                          |

**`replay` mode**

| Name      | Required   | Example                                | Description                                        |
|-----------|------------|----------------------------------------|----------------------------------------------------|
| `game`    | `REQUIRED` | `myGame`                               | _Game_ Id                                          |
| `roundId` | `REQUIRED` | `123e4567-e89b-12d3-a456-426614174000` | Round Id, one round can have multiple transactions |

## API

**Path**:`{serverUrl}/rgs/{rgs}/authenticate`
**Method**:`POST`
**Authorization**:`X-Server-Authorization`
**Idempotent**:`NO`

Authenticates a _Player_ and starts a new session.

**Body**

| Name       | Type     | Required   | Example           | Description                                                                                   |
|------------|----------|------------|-------------------|-----------------------------------------------------------------------------------------------|
| `provider` | `string` | `REQUIRED` | `MyProvider`      | _Provider_ Id                                                                                 |
| `wallet`   | `string` | `REQUIRED` | `MyWallet`        | _Wallet_ Id                                                                                   |
| `operator` | `string` | `REQUIRED` | `MyOperator`      | _Operator_ Id                                                                                 |
| `key`      | `string` | `REQUIRED` | `dnsa89me329jdos` | _Wallet's_ session initialisation key which `SHOULD` be active only one time after generation |
| `game`     | `string` | `OPTIONAL` | `myGame`          | _Game_                                                                                        |
| `ip`       | `string` | `OPTIONAL` | `1.2.3.4`         | Player IP address                                                                             |
| `channel`  | `string` | `OPTIONAL` | `desktop`         | _Player's_ device (`desktop`, `mobile`)                                                       |

**Response**

| Name           | Type     |            | Example        | Description                                                                                |
|----------------|----------|------------|----------------|--------------------------------------------------------------------------------------------|
| `sessionId`    | `string` | `REQUIRED` | `xxx`          | _Adapter's_ Session Id                                                                     |
| `playerId`     | `string` | `REQUIRED` | `user123432`   | _Adapter's_ Player Id                                                                      |
| `nativeId`     | `string` | `REQUIRED` | `user123432`   | _Wallet's_ Player Id                                                                       |
| `balance`      | `number` | `REQUIRED` | `100.85`       | _Player's_ current balance                                                                 |
| `currency`     | `string` | `REQUIRED` | `eur`          | _Player's_ currency (lowercase), ***cannot change once set!***                             |
| `brand`        | `string` | `REQUIRED` | `YellowCasino` | _Operator's_ brand                                                                         |
| `nickname`     | `string` | `OPTIONAL` | `JohnyBravo`   | _Player's_ nickname                                                                        |
| `gender`       | `string` | `OPTIONAL` | `m`            | _Player's_ gender (`m` or `f`)                                                             |
| `country`      | `string` | `OPTIONAL` | `uk`           | _Player's_ country code in [ISO 3166-1 Alpha-2](https://www.iban.com/country-codes) format |
| `jurisdiction` | `string` | `OPTIONAL` | `mt`           | _Player's_ jurisdiction in case of specific market requirements i.e. `MT`, `UK`, `DK`      |

---

**Path**:`{serverUrl}/rgs/{rgs}/balance`
**Method**:`GET`
**Authorization**:`X-Server-Authorization`
**Idempotent**:`YES`

Returns _Player's_ current balance in _Player's_ currency.

**Query Parameters**

| Name       | Type     | Required   | Example      | Description          |
|------------|----------|------------|--------------|----------------------|
| `playerId` | `string` | `REQUIRED` | `user123432` | _Wallet's_ Player Id |
| `provider` | `string` | `REQUIRED` | `MyProvider` | _Provider_ Id        |
| `game`     | `string` | `REQUIRED` | `superSlot`  | Name of the game     |

**Response**

| Name      | Type     |            | Example  | Description                |
|-----------|----------|------------|----------|----------------------------|
| `balance` | `number` | `REQUIRED` | `100.85` | _Player's_ current balance |

---

**Path**:`{serverUrl}/rgs/{rgs}/transaction`
**Method**:`PUT`
**Authorization**:`X-Server-Authorization`
**Idempotent**:`YES`

Withdraws or deposits money from _Player's_ account.

**Body**

| Name               | Type          |            | Example                                                                                       | Description                                                                                                                                                                                                                                                                                    |
|--------------------|---------------|------------|-----------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `playerId`         | `string`      | `REQUIRED` | `user123432`                                                                                  | _Adapter's_ _Player_ Id                                                                                                                                                                                                                                                                        |
| `rgsTransactionId` | `string`      | `REQUIRED` | `321e4567-e89b-45d3-b594-41234174249`                                                         | Provider _Transaction_ Id. `MUST` be unique identifier within provider                                                                                                                                                                                                                         |
| `type`             | `string`      | `REQUIRED` | `withdraw`                                                                                    | `withdraw` reduces _Player's_ balance.<br/>`deposit` increases _Player's_ balance.                                                                                                                                                                                                             |
| `amount`           | `number`      | `REQUIRED` | `10.56`                                                                                       | Amount in _Player's_ currency to withdraw from the account. Withdrawal of 0 (zero) amount `MUST` be supported.                                                                                                                                                                                 |
| `jackpotAmount`    | `number`      | `OPTIONAL` | `0.0017`                                                                                      | Part of `amount` which goes to jackpot contribution (in case of withdrawals) or jackpot win (in case of deposits). It is only for information purpose, this value should not affect _Player's_ balance on top of 'amount'`. Please note contribution can have more then usual 2-decimal places |
| `provider`         | `string`      | `REQUIRED` | `MyProvider`                                                                                  | _Provider_ Id                                                                                                                                                                                                                                                                                  |
| `game`             | `string`      | `REQUIRED` | `superSlot`                                                                                   | Name of the game                                                                                                                                                                                                                                                                               |
| `variant`          | `string`      | `OPTIONAL` | `superSlot`                                                                                   | Variant of the game                                                                                                                                                                                                                                                                            |
| `roundId`          | `string`      | `REQUIRED` | `123e4567-e89b-12d3-a456-426614174000`                                                        | Round Id, one round can have multiple transactions                                                                                                                                                                                                                                             |
| `roundFinished`    | `boolean`     | `OPTIONAL` | `true`                                                                                        | Indicates whether round has finished                                                                                                                                                                                                                                                           |
| `category`         | `string`      | `OPTIONAL` | `promo`                                                                                       | Category of transaction: `normal`, `side`, `tip`, `promo`, `jackpot`                                                                                                                                                                                                                           |
| `name`             | `string`      | `OPTIONAL` | `Royal Match`                                                                                 | Name of the transaction                                                                                                                                                                                                                                                                        |
| `channel`          | `string`      | `OPTIONAL` | `mobile`                                                                                      | Channel of the device: `mobile` or `desktop`                                                                                                                                                                                                                                                   |
| `campaignType`     | `string`      | `OPTIONAL` | `freeBets`                                                                                    | Type of promotional tool `freeBets`, `prizeDrop`, `mystery` (can be more)                                                                                                                                                                                                                      |
| `campaignId`       | `string`      | `OPTIONAL` | `myCampaign123`                                                                               | Id of promotional campaign                                                                                                                                                                                                                                                                     |
| `winRatio`         | `number`      | `OPTIONAL` | `123.45`                                                                                      | Win divided by base game bet (only for `deposit`)                                                                                                                                                                                                                                              |
| `ip`               | `string`      | `OPTIONAL` | `1.2.3.4`                                                                                     | Player IP address                                                                                                                                                                                                                                                                              |
| `regulatory`       | `IRegulatory` | `OPTIONAL` | `{ pt: { "sm_result": "0:1;3;1;1;1#5;0;7;2;1#5;0;5;2;2#", "descr_ap": "60GoldenCoinsPro" } }` | Regulatory information required only in deposit transactions, currently required for games to go live in Portugal [See IRegulatory](#iregulatory)                                                                                                                                              |

#### IRegulatory

| Name              | Type                    |            | Example                            | Description                                      |
|-------------------|-------------------------|------------|------------------------------------|--------------------------------------------------|
| `pt["sm_result"]` | `string`                | `OPTIONAL` | `0:1;3;1;1;1#5;0;7;2;1#5;0;5;2;2#` | sm_result AJOG file entry                        |
| `pt["descr_ap"]`  | `string`                | `OPTIONAL` | `60GoldenCoinsPro`                 | descr_ap AJOG file entry                         |
| `pt`              | `[key: string]: string` | `OPTIONAL` |                                    | Dictronary with other optional AJOG file entries |

**Response**

| Name      | Type     |            | Example  | Description                |
|-----------|----------|------------|----------|----------------------------|
| `balance` | `number` | `OPTIONAL` | `100.85` | _Player's_ current balance |

---

**Path**:`{serverUrl}/rgs/{rgs}/cancel`
**Method**:`DELETE`
**Authorization**:`X-Server-Authorization`
**Idempotent**:`YES`

Returns once withdrew money to original account.
Cancels `SHOULD NOT` be triggered after receiving the following error codes from transaction: `INSUFFICIENT_FUNDS`, `LOSS_LIMIT`, `TRANSACTION_FAILED`, `TRANSACTION_REJECTED`.
You need to specify either `rgsTransactionId` to cancel individual transaction or `roundId` to cancel all withdrawals from given round.s

**Body**

| Name               | Type     |            | Example                               | Description                |
|--------------------|----------|------------|---------------------------------------|----------------------------|
| `rgsTransactionId` | `string` | `OPTIONAL` | `321e4567-e89b-45d3-b594-41234174249` | Providers _Transaction_ Id |
| `roundId`          | `string` | `OPTIONAL` | `321e4567-e89b-45d3-b594-41234174249` | Providers _Round_ Id       |

**Response**

| Name      | Type     |            | Example  | Description                |
|-----------|----------|------------|----------|----------------------------|
| `balance` | `number` | `REQUIRED` | `100.85` | _Player's_ current balance |

---
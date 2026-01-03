# Provably Fair

## Introduction

This document describes Provably Fair RNG implementation for single-player and multiplayer games.

## Single-player

Provable fairness in single-player games relies on combining a _Player Seed_ with a pre-committed _Casino Seed_. 
Thanks to casino's Cryptographic Commitment, players can independently verify that game outcomes are fair and have not been tampered with by the casino.

### Generating Hash Buffer

For each single-player Round, subsequent hashes used for extracting random numbers are generated with the following formula:

```HMAC_SHA256(SERVER_SEED,$CLIENT_SEED:$NONCE:$HASH_INDEX)```

where _Hash Index_ is incremented for as many extractions as the Round requires (see: General Concepts / Hash Buffer).

#### Server seed

The server seed is a generated 64-character hexadecimal string created by our system. Before placing any bets, players are provided with an encrypted hash of this server seed. This ensures the server seed cannot be altered by the casino
operator, and that players cannot predict the results in advance.

To reveal the server seed from its hashed version, players must rotate the seed, prompting the system to generate a new one. At this point, you can verify that the hashed server seed matches the un-hashed version. This verification can be
done by hashing the seed as a value (`HASH_SHA256($SERVER_SEED)`).

#### Client seed

The client seed is a string with up to 64 characters controlled by the player, ensures that players have an influence on the randomness of the outcomes. 
Without it, the server seed would solely determine the outcome of each bet. 
Players are encouraged to regularly change their client seed to create a new sequence of random outcomes. 
This process gives players control over the result generation, similar to cutting the deck in a brick-and-mortar casino.

During the first authentication, a client seed is automatically created to provide a seamless initial experience. 
While this randomly generated client seed is adequate, we strongly recommend choosing your own to incorporate your influence into the randomness.

#### Nonce

The nonce is a number that increments with each new round. 
Because of the nature of the SHA256 cryptographic function, this ensures a completely new result is generated every time, without the need to create new client and server seeds. 
The use of a nonce allows us to remain committed to your existing client and server seed pair while still generating unique results for each round.

### Implementation

#### node.js

```javascript

function random(serverSeed, clientSeed, nonce, cursor) {
    // Generate hmac
    const hashIndex = Math.floor(cursor / 8);
    const hmac = crypto.createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${hashIndex}`);

    // Read integer from the buffer
    const offset = cursor % 8;
    const result = hmac.digest().readUInt32BE(offset * 4);

    return result;
}
```

#### JavaScript in the Browser

Requires installing `crypto-js` (https://github.com/brix/crypto-js)

```javascript
import CryptoJS from "crypto-js";

function random(serverSeed, clientSeed, nonce, cursor) {
    // Generate hmac
    const hashIndex = Math.floor(cursor / 8);
    const hmac = CryptoJS.HmacSHA256(`${clientSeed}:${nonce}:${hashIndex}`, serverSeed);

    // Read the integer and conver from signed to unsigned
    const offset = cursor % 8;
    const result = hmac.words[offset] >>> 0;

    return result;
}
```

## Multiplayer

Provable fairness in multiplayer games relies on combining a players' _Seed_ with a _Hash_ from a pre-generated casino _Hash Chain_. 
This _Hash Chain_ is created before the game room is instantiated.

To ensure transparency casino commits to the _Hash Chain_ by revealing its _Last Hash_ to the community of players. 
Once the _Last Hash_ is shared, players' _Seed_ is set for the players, ensuring that the Hash Chain could not have been manipulated in a way that benefits the casino.

### Generating hash buffer 

Given the multiplayer draw's _Hash_ and _Seed_, the _Hash Buffer_ is generated with the following formula:

```HMAC_SHA256(HASH,$SEED:$HASH_INDEX)```

where _Hash Index_ is incremented for as many extractions as the Draw requires (see: General Concepts / Hash Buffer).

#### Hash

**NOTE:** it can be confusing that term _Hash_ has a different meaning in context of _Hash Chain_ and _Hash Buffer_. _Hashes_ from the Chain are used to create Hmac generating the _Hash Buffer_ for the given draw.

Casino pre-generates a long sequence (usually 1-10 million long) of SHA256 hashes. Starting from random 32-bytes hex string and then using the formula:

```HASH = SHA256(PREVIOUS_HASH)```

Last hash from this _Hash Chain_ is not used for random numbers generation (it's intended for publishing to the players), but then each multiplayer Draw will consume the next _Hash_ in a backwards fashion.
I.e. the first Draw of the multiplayer Room will use the _Hash_ that was used to produce the very _Last Hash_, the second draw will use the one before and so on.

Due to the nature of hashing algorithms (SHA256 in this case) - even if the current hash is revealed to the players, noone is able to decode which one was used to generate it and predict the next round RNG output.

On the other hand, once the _Hash_ is revealed after the Draw is finished, everyone is able to apply SHA256 calculus and verify that this _Hash_ was indeed the one to produce the one used for previous Draw, thus ensuring _Hash Chain_ consistency and casino's initial _Hash Chain_ commitment. 

#### Seed

The players' _Seed_ is a string with up to 64 characters that can be set in the Back-Office for a given multiplayer Room.
It can only be set once the _Hash Chain_ is generated. 

It's up to the casino to inform players about _Last Hash_ before setting players' _Seed_.
Preferably it should be set to some future value declared at the moment of _Chain Hash_ commitment - such as future Bitcoin block hash.
Only then _Seed_ will ensure that players have an influence on the randomness of the outcomes and that _Hash Chain_ was not generated to casino's advantage.

### Implementation

#### node.js

```javascript

function random(hash, seed, cursor) {
    // Generate hmac
    const hashIndex = Math.floor(cursor / 8);
    const hmac = crypto.createHmac("sha256", hash).update(`${seed}:${hashIndex}`);

    // Read integer from the buffer
    const offset = cursor % 8;
    const result = hmac.digest().readUInt32BE(offset * 4);

    return result;
}
```

#### JavaScript in the Browser

Requires installing `crypto-js` (https://github.com/brix/crypto-js)

```javascript
import CryptoJS from "crypto-js";

function random(hash, seed, cursor) {
    // Generate hmac
    const hashIndex = Math.floor(cursor / 8);
    const hmac = CryptoJS.HmacSHA256(`${seed}:${hashIndex}`, hash);

    // Read the integer and conver from signed to unsigned
    const offset = cursor % 8;
    const result = hmac.words[offset] >>> 0;

    return result;
}
```

## General concepts

Algorithms described in this section apply to both single-player and multiplayer random numbers generation.

### Hash Buffer

Both Single-player Round and Multiplayer Draw can require multiple random numbers to generate the gameplay.
To make it possible while providing ways to prove fairness, each Round and Draw is provided a _Hash Buffer_ (which is theoretically infinite).
Both these game modes use different techniques for generating _Hash Buffer_, but the technique of consuming numbers from this buffer is common.

### Integers extraction

Games  use 4 bytes from the _Hash Buffer_ to generate each requested random number.
Since SHA256 provides 32 bytes, we can return 8 32-bit unsigned integers from each hash.
Bytes are interpreted as unsigned integers in a Big Endian order.

### Cursor and hash index

The cursor is incremented every time new random number is requested, as well as when the random number requires re-rolling (see: Generating number under a limit).
When the game requests more than 8 numbers in a single round/draw (32 bytes / 4 bytes) we will increment hashIndex and generate new hash.

### Generating number under a limit

It is quite common that a game needs to get a random number under a specified limit (e.q. under 100 so `[0-100)`).
Multiplying integer by a float can generate a random number within a range, but it may introduce bias when converting the floating-point result to an integer.

The `unbiasedRandomInteger` function ensures a truly uniform distribution by carefully managing the range and using the modulo operation.

```javascript
function unbiasedRandomInteger(limit) {
    // Determine the Smallest Power of 2 Greater Than or Equal to the Limit:
    let power = 1;
    while (power < limit) {
        power *= 2;
    }

    // Generate a Random Integer avoiding the bias
    let number;
    do {
        const int = random();
        number = int % power;
    } while (number >= limit);

    return number;
}
```

## API

**Path**:`/fairness/updateClientSeed`
**Method**:`POST`
**Authorization**:`YES`

Attempts to update _Player Seed_. Throws error if any rounds are open on the current _Player Seed_.

**Body**

| Name         | Type     |            | Example                | Description       |
|--------------|----------|------------|------------------------|-------------------|
| `clientSeed` | `string` | `REQUIRED` | `my-lucky-player-seed` | new _Player Seed_ |

**Response**

| Name                 | Type       | Example                | Description                                                                                                              |
|----------------------|------------|------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `clientSeed`         | `string`   | `my-lucky-player-seed` | new _Player Seed_                                                                                                        |
| `serverSeedHash`     | `string`   | `c200626f`             | hashed _Server Seed_                                                                                                     |
| `nextServerSeedHash` | `string`   | `31b3bb7b`             | hashed next _Server Seed_ (the underlying seed will be used as active _Server Seed_ next time when player updates Seeds) |
| `nonce`              | `number`   | 0                      | current nonce                                                                                                            |
| `unfinishedGames`    | `string[]` | []                     | array of games with rounds open on active seeds (empty)                                                                  |

---

**Path**:`/fairness/activeRngSeeds`
**Method**:`GET`
**Authorization**:`YES`

Gets active _Player Seeds_ for the authenticated player (no arguments required)

**Response**

| Name                 | Type       | Example                | Description                                                                                                              |
|----------------------|------------|------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `clientSeed`         | `string`   | `my-lucky-player-seed` | new _Player Seed_                                                                                                        |
| `serverSeedHash`     | `string`   | `c200626f`             | hashed _Server Seed_                                                                                                     |
| `nextServerSeedHash` | `string`   | `31b3bb7b`             | hashed next _Server Seed_ (the underlying seed will be used as active _Server Seed_ next time when player updates Seeds) |
| `nonce`              | `number`   | 1234                   | current nonce                                                                                                            |
| `unfinishedGames`    | `string[]` | ["dice", "plinko"]     | array of games with open rounds on the active seeds (these rounds need to be completed in order to update _Player Seed_  |

---

**Path**:`/fairness/roundRngState`
**Method**:`GET`
**Authorization**:`NO`

Returns Provably Fair round RNG state for a given `roundId`.

**Query Parameters**

| Name      | Type     |            | Example                                | Description |
|-----------|----------|------------|----------------------------------------|-------------|
| `roundId` | `string` | `REQUIRED` | `d615412f-1e9b-4f0c-9b6c-494d68b234a8` | roundId     |

**Response**

| Name                 | Type     | Example                | Description                                                                                                              |
|----------------------|----------|------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `clientSeed`         | `string` | `my-lucky-player-seed` | _Player Seed_ that this round was played on                                                                              |
| `serverSeedHash`     | `string` | `31b3bb7b`             | hashed _Server Seed_ that this round was played on                                                                       |
| `nextServerSeedHash` | `string` | `73a29388`             | hashed next _Server Seed_ (the underlying seed will be used as active _Server Seed_ next time when player updates Seeds) |
| `nonce`              | `number` | 231                    | nonce for the given round                                                                                                |
| `serverSeed`         | `string` | `f8bc155a`             | present only if server seed was revealed                                                                                 |
| `status`             | `string` | "active" or "revealed" | seeds status                                                                                                             |

---

**Path**:`/fairness/unhashServerSeed`
**Method**:`GET`
**Authorization**:`NO`

Returns unhashed server seed if this seed was revealed (i.e. player rotated the Seeds).

**Query Parameters**

| Name             | Type     |            | Example    | Description    |
|------------------|----------|------------|------------|----------------|
| `serverSeedHash` | `string` | `REQUIRED` | `31b3bb7b` | hash to reveal |

**Response**

| Name         | Type     | Example    | Description                                                     |
|--------------|----------|------------|-----------------------------------------------------------------|
| `serverSeed` | `string` | `f8bc155a` | unhashed server seed - present only if server seed was revealed |

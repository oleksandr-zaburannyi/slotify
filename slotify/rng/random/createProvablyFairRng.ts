import {validateRandomLimit} from "./factory";
import * as crypto from "crypto";
import {IRoundRngState} from "./IRoundRngState";
import {unbiasedRandomInteger} from "./unbiasedRandomInteger";
import {IRandom} from "./IRandom";
import {IDrawRngState} from "./IDrawRngState";

export interface IProvablyFairRng {
    random: IRandom;
    getRngCursor: () => number;
}

export function createProvablyFairRng({serverSeed, clientSeed, nonce, cursor}: IRoundRngState): IProvablyFairRng {
    const hmacFactory = (hashIndex: number) => createHmac(serverSeed, clientSeed, nonce, hashIndex);
    return createRng(hmacFactory, cursor);
}

export function createProvablyFairMultiplayerRng({hash, seed, cursor}: IDrawRngState): IProvablyFairRng {
    const hmacFactory = (hashIndex: number) => createMultiplayerHmac(hash, seed, hashIndex);
    return createRng(hmacFactory, cursor);
}

function createRng(hmacFactory: (hashIndex: number) => crypto.Hmac, cursor: number) {
    return {
        random: (limit = 2 ** 32) => {
            validateRandomLimit(limit);
            return unbiasedRandomInteger(limit, () => {
                const extractedInteger = extractInteger(hmacFactory, cursor);
                cursor++;
                return extractedInteger.integer;
            });
        },
        getRngCursor: () => cursor,
    };
}

export interface IIntegerExtraction {
    cursor: number;
    hashIndex: number;
    offset: number;
    integer: number;
}

export function extractInteger(createHmac: (hashIndex: number) => crypto.Hmac, cursor: number): IIntegerExtraction {
    const hashIndex = Math.floor(cursor / 8);
    const hmac = createHmac(hashIndex);

    const offset = cursor % 8;
    const integer = hmac.digest().readUInt32BE(offset * 4);
    return {
        cursor,
        hashIndex,
        offset,
        integer,
    };
}

export function createHmac(serverSeed: string, clientSeed: string, nonce: number, hashIndex: number): crypto.Hmac {
    return crypto.createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${hashIndex}`);
}

export function createMultiplayerHmac(hash: string, seed: string, hashIndex: number): crypto.Hmac {
    return crypto.createHmac("sha256", hash).update(`${seed}:${hashIndex}`);
}

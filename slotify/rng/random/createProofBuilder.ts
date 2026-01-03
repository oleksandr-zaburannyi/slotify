import {unbiasedRandomInteger} from "./unbiasedRandomInteger";
import {createHmac, createMultiplayerHmac, extractInteger, IIntegerExtraction} from "./createProvablyFairRng";
import {IInitialRngState} from "./IRoundRngState";
import * as crypto from "crypto";

export type IRandomizationBuilder = (limit: number, gameEventProducer: (randomNumber: number) => any) => void;

export interface IProofBuilder {
    addRandomization: IRandomizationBuilder;
    build: () => IProof;
}

interface IProof {
    hashes: IHash[];
    randomizations: IRandomization[];
}

interface IHash {
    hex: string;
    bytes: number[];
}

interface IRandomization {
    limit: number;
    extractions: IIntegerExtraction[];
    randomNumber: number;
    gameEvent: any;
}

export function createProofBuilder({serverSeed, clientSeed, nonce}: IInitialRngState): IProofBuilder {
    const hmacFactory = (hashIndex: number) => createHmac(serverSeed, clientSeed, nonce, hashIndex);
    return createBuilder(hmacFactory);
}

export function createMultiplayerProofBuilder({hash, seed}: {hash: string; seed: string}): IProofBuilder {
    const hmacFactory = (hashIndex: number) => createMultiplayerHmac(hash, seed, hashIndex);
    return createBuilder(hmacFactory);
}

function createBuilder(createHmac: (hashIndex: number) => crypto.Hmac) {
    const hashes: IHash[] = [];
    const randomizations: IRandomization[] = [];

    let cursor = 0;
    const addRandomization = (limit: number, gameEventProducer: (randomNumber: number) => any) => {
        const extractions: IIntegerExtraction[] = [];

        const randomNumber = unbiasedRandomInteger(limit, () => {
            const extraction = extractInteger(createHmac, cursor);

            if (extraction.hashIndex >= hashes.length) {
                hashes.push({
                    hex: createHmac(extraction.hashIndex).digest("hex"),
                    bytes: Array.from(createHmac(extraction.hashIndex).digest()),
                });
            }

            extractions.push(extraction);
            cursor++;

            return extraction.integer;
        });

        randomizations.push({
            limit,
            extractions,
            randomNumber,
            gameEvent: gameEventProducer(randomNumber),
        });
    };

    return {
        addRandomization,
        build: () => ({hashes, randomizations}),
    };
}

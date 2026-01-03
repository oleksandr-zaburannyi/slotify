import * as crypto from "crypto";

export function generateSeed(): string {
    return crypto.randomBytes(32).toString("hex");
}

export function generateSeedHash(seed: string): string {
    return crypto.createHash("sha256").update(seed).digest("hex");
}

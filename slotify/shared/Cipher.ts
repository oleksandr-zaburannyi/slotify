import * as crypto from "crypto";
import Exception from "./Exception";

class Cipher {
    private readonly encryptionKey: string;
    private readonly encryptionIV: string;

    constructor(secretKey: string, iv: string) {
        this.encryptionKey = crypto.createHash("sha512").update(secretKey).digest("hex").substring(0, 32);
        this.encryptionIV = crypto.createHash("sha512").update(iv).digest("hex").substring(0, 16);
    }

    encrypt(value: string): string {
        const cipher = crypto.createCipheriv("aes-256-cbc", this.encryptionKey, this.encryptionIV);
        const str = cipher.update(value, "utf8", "hex") + cipher.final("hex");
        return Buffer.from(str).toString("base64");
    }

    decrypt(value: string): string {
        try {
            const buff = Buffer.from(value, "base64");
            const decipher = crypto.createDecipheriv("aes-256-cbc", this.encryptionKey, this.encryptionIV);
            return decipher.update(buff.toString("utf8"), "hex", "utf8") + decipher.final("utf8");
        } catch {
            throw new Exception("Error during decrypting");
        }
    }
}

export default Cipher;

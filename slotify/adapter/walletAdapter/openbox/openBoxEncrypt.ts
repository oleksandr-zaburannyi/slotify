import * as crypto from "crypto";

export default function openBoxEncrypt(payload: string, secretKey: string) {
    const cipher = crypto.createCipheriv("aes-256-ecb", secretKey, null);

    let encrypted = cipher.update(payload, "utf8", "base64");
    encrypted += cipher.final("base64");

    return encrypted;
}

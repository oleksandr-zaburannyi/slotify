import Cipher from "./Cipher";

test("Cipher - encrypt and decrypt", async () => {
    const cipher = new Cipher("secret", "iv");
    expect(cipher.decrypt(cipher.encrypt("test"))).toEqual("test");
});

test("Cipher - different secret", async () => {
    const cipher1 = new Cipher("secret1", "iv");
    const cipher2 = new Cipher("secret2", "iv");
    expect(cipher1.encrypt("test")).not.toEqual(cipher2.encrypt("test"));
});

test("Cipher - different iv", async () => {
    const cipher1 = new Cipher("secret", "iv1");
    const cipher2 = new Cipher("secret", "iv2");
    expect(cipher1.encrypt("test")).not.toEqual(cipher2.encrypt("test"));
});

test("Cipher - wrong secret", async () => {
    const cipher1 = new Cipher("secret", "iv1");
    const cipher2 = new Cipher("secret2", "iv1");
    expect(() => cipher1.decrypt(cipher2.encrypt("test"))).toThrow("Error during decrypting");
});

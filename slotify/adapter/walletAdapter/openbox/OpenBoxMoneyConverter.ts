import Exception from "@slotify/shared/lib/Exception";

const centsAmount = 100;

export function toOpenBoxFormat(amount: number): number {
    return Math.round(amount * centsAmount);
}

export function fromOpenBoxFormat(amount: any): number {
    if (typeof amount !== "number") {
        throw new Exception("Incorrect incoming balance");
    }

    return amount / centsAmount;
}

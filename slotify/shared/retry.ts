import Exception from "./Exception";
import wait from "./wait";

export async function retry(func: () => Promise<boolean>, timeout: number, delay: (n: number) => number) {
    let result = false;
    let n = 1;
    const start = Date.now();
    do {
        if (Date.now() - start > timeout) {
            throw new Exception("Repeated task timeout");
        }
        result = await func();
        if (!result) {
            await wait(delay(n++));
        }
    } while (!result);
}

import {executeInQueue} from "./queue";
import wait from "./wait";
import {closeRedis, initRedis} from "./redis";

beforeAll(async () => {
    await initRedis("shared");
});
afterAll(async () => {
    await closeRedis();
});

test("queue", async () => {
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
        executeInQueue("test-queue", async () => {
            order.push("before");
            await wait(100);
            order.push("after");
        }).then(() => null);
    }
    await wait(500);
    expect(order).toEqual(["before", "after", "before", "after", "before", "after"]);
});

test("queue - no id", async () => {
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
        executeInQueue(false, async () => {
            order.push("before");
            await wait(100);
            order.push("after");
        }).then(() => null);
    }
    await wait(500);
    expect(order).toEqual(["before", "before", "before", "after", "after", "after"]);
});

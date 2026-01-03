import wait from "./wait";
import cache, {invalidate} from "./cache";
import {describe, expect} from "@jest/globals";

jest.mock("./redis", () => {
    let handler: any;
    return {
        redisPubSub: {
            unsubscribe: () => Promise.resolve(),
            isReady: true,
            subscribe: (_: string, func: any) => {
                handler = func;
                return new Promise(resolve => resolve(true));
            },
        },
        redis: {
            publish: () => {
                handler!();
                return new Promise(resolve => resolve(true));
            },
        },
    };
});

describe("cache", () => {
    test("cache without params", async () => {
        let i = 0;
        const cached = cache(0.5, () => {
            return ++i;
        });
        expect(cached()).toEqual(1);
        expect(cached()).toEqual(1);
        await wait(510);
        expect(cached()).toEqual(2);
        expect(cached()).toEqual(2);
        await wait(510);
        expect(cached()).toEqual(3);
        expect(cached()).toEqual(3);
    });

    test("cache with params", async () => {
        let i = 0;
        const cached = cache(0.5, (str: string) => {
            return ++i + str;
        });
        expect(cached("a")).toEqual("1a");
        expect(cached("b")).toEqual("2b");
        expect(cached("a")).toEqual("1a");
        expect(cached("b")).toEqual("2b");
        await wait(510);
        expect(cached("a")).toEqual("3a");
        expect(cached("b")).toEqual("4b");
    });

    test("invalidate", async () => {
        let i = 0;
        const cached = cache(0.5, () => ++i, ["test"]);
        expect(cached()).toEqual(1);
        expect(cached()).toEqual(1);
        invalidate("test");
        await wait(10);
        expect(cached()).toEqual(2);
        expect(cached()).toEqual(2);
        await wait(510);
        expect(cached()).toEqual(3);
        expect(cached()).toEqual(3);
    });
});

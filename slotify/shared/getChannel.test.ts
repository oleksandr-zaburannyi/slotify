import {getChannel} from "./getChannel";

test("is undefined", () => {
    expect(getChannel(undefined)).toBe(undefined);
});

test("is mobile", () => {
    const iPhoneUserAgent = "Mozilla/5.0 (iPhone14,3; U; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/19A346 Safari/602.1";
    const iPadUserAgent =
        "Mozilla/5.0 (iPad; U; CPU OS 5_0 like Mac OS X; en-us) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.0.2 Mobile/9A5248d Safari/6533.18.5#2.0#TCL/TCL-AP-RT41DT-S1/28/tclwebkit1.0.2/1920*1080(561935664,null;313038280,33194b66ccc743eea00cff0efd042934)";
    const androidUserAgent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36";

    expect(getChannel(iPhoneUserAgent)).toBe("mobile");
    expect(getChannel(iPadUserAgent)).toBe("mobile");
    expect(getChannel(androidUserAgent)).toBe("mobile");
});

test("is desktop", () => {
    const desktopUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9";

    expect(getChannel(desktopUserAgent)).toBe("desktop");
});

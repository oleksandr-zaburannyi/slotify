import {Request} from "express";
import {matches} from "ip-matching";

export function getIp(req: Pick<Request, "headers" | "socket">) {
    return ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "").split(",")[0];
}

export function checkIPWhitelisting(ip: string, whitelistedIps: string[]) {
    if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

    for (const whitelistedIp of whitelistedIps) {
        try {
            if (matches(ip, whitelistedIp)) {
                return true;
            }
        } catch {
            return false;
        }
    }
    return false;
}

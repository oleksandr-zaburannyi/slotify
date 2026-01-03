import {Request} from "express";

export function getIp(req: Request) {
    return ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "").split(",")[0];
}

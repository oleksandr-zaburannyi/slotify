import * as crypto from "crypto";
import {NextFunction, Request, RequestHandler, Response} from "express";
import Exception from "../Exception";

export function hmac(secretKey: string): RequestHandler {
    return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
        if (!req.headers["x-server-authorization"]) throw new Exception("No authorization header");
        const body = (req as any).rawBody || "{}";
        const hmac = crypto.createHmac("sha256", secretKey).update(body).digest("hex");
        if (req.headers["x-server-authorization"] !== hmac) throw new Exception("Incorrect hmac signature", {data: {hmac, secretKey, body}});

        next();
    };
}

export function validateJsonHmac(message: string, signature: string, secretKey: string) {
    if (!signature) throw new Exception("No signature");

    const hmac = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
    if (signature !== hmac) throw new Exception("Incorrect hmac signature", {data: {hmac, secretKey, message}});
}

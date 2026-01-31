import {NextFunction, Request, RequestHandler, Response} from "express";
import {sign, verify} from "jsonwebtoken";
import Exception from "../Exception";
import Cipher from "../Cipher";

const secretKey: string = process.env.JWT_SECRET || "";

const cipher = new Cipher(secretKey, "slotify");

export default {
    verify(role: string, optional = false): RequestHandler {
        return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
            const token = getToken(req);
            if (!token) {
                if (optional) {
                    return next();
                }
                throw new Exception("No authorization header");
            }

            try {
                const {data} = verify(token, secretKey, {audience: role}) as {data: string};
                res.locals.user = JSON.parse(cipher.decrypt(data));
                next();
            } catch {
                if (optional) {
                    return next();
                }
                throw new Exception("Incorrect authorization token", {data: {authorization: req.headers.authorization, token, role}});
            }
        };
    },
    sign(user: any, role: string): string {
        return sign({data: cipher.encrypt(JSON.stringify(user))}, secretKey, {expiresIn: "14d", audience: role});
    },
};

export function getToken(req: Request): string | undefined {
    if (!req.headers.authorization) return undefined;

    const [bearer, token] = req.headers.authorization.split(" ");
    if (bearer !== "Bearer" || !token) {
        throw new Exception("Incorrect authorization format", {
            data: {authorization: req.headers.authorization},
        });
    }

    return token;
}

export function decrypt(token: string, role: string): any {
    const {data} = verify(token, secretKey, {audience: role}) as {data: string};
    return JSON.parse(cipher.decrypt(data));
}

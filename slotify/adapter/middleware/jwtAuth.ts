import {Account} from "../db/model/Account";
import {NextFunction, Request, Response} from "express";
import {sign, verify} from "jsonwebtoken";
import Exception from "@slotify/shared/lib/Exception";
import logger from "@slotify/shared/lib/logger";
import {getIp} from "@slotify/shared/lib/ip";

const secretKey: string = process.env.JWT_SECRET || "";
const sessionExpiryHours = process.env.SESSION_EXPIRY_HOURS ? parseFloat(process.env.SESSION_EXPIRY_HOURS) : 4;

export const jwtAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.headers.authorization) return next();
    try {
        const [bearer, token] = req.headers.authorization.split(" ");
        if (bearer !== "Bearer") throw new Exception("Wrong token format");
        const {email} = (await verify(token, secretKey, {audience: "account"})) as any;
        const account = await Account.findOneBy({email});
        if (!account) throw new Exception("Account not found");

        const lastActivityLimit = new Date();
        lastActivityLimit.setHours(lastActivityLimit.getHours() - sessionExpiryHours);

        const ip = getIp(req);
        const isIpWhitelisted = account.isWhitelisted(ip);

        const timePassed = account.lastActivity && account.lastActivity.getTime() < lastActivityLimit.getTime();
        if (!isIpWhitelisted && (timePassed || !account.activeSession)) {
            throw new Exception("Session expired", {code: "SESSION_EXPIRED"});
        }
        if (account.ips && !isIpWhitelisted) {
            throw new Exception("Access denied", {code: "ACCESS_DENIED"});
        }
        await Account.update({email}, {lastActivity: new Date()});

        res.locals.account = account.toData();
        next();
    } catch (error) {
        logger.warn("GraphqlQL access error", {error});
        return next(error);
    }
};

export const jwtSign = (email: any, role: string = "account"): string => {
    return sign({email}, secretKey, {audience: role});
};

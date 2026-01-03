import {checkIPWhitelisting, getIp} from "@slotify/shared/lib/ip";
import Exception from "@slotify/shared/lib/Exception";
import {NextFunction, Request, Response} from "express";

// Private IP ranges to detect internal traffic
export const internalIPRanges = [
    "10.0.0.0/8", // private
    "172.16.0.0/12", // private
    "192.168.0.0/16", // private
    "127.0.0.0/8", // loopback
    "169.254.0.0/16", // link-local
    "::1/128", // IPv6 loopback
    "fc00::/7", // IPv6 unique local
    "fe80::/10", // IPv6 link-local
];

export function ipFilter(ips?: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const ip = getIp(req);
        if (!ips) throw new Exception("Whitelisted IPs not defined");
        if (!checkIPWhitelisting(ip, ips)) {
            throw new Exception("Wallet IP not whitelisted", {data: {ip, ips}});
        }
        next();
    };
}

export function anonymiseIp(ip?: string) {
    return process.env.ANONYMISE_IPS !== "true" ? ip : undefined;
}

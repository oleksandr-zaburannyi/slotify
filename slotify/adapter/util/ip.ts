import {matches} from "ip-matching";
import {getIp} from "@slotify/shared/lib/ip";
import Exception from "@slotify/shared/lib/Exception";
import {NextFunction, Request, Response} from "express";
import {Wallet} from "../db/model/Wallet";

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

const geoIpBlockedStates = (process.env.GEO_IP_BLOCKED_STATES || "")
    .split(",")
    .filter(state => !!state)
    .map(state => state.toLowerCase());
const ipGeolocationApiKey = process.env.IPGEOLOCATION_API_KEY;

export const isIpBlocked = async (wallet: string, ipBlocked: boolean | undefined): Promise<boolean> => {
    if (!ipBlocked) return false;
    if (!(await Wallet.isIpBlocked(wallet))) return false;

    return true;
};

export const isGeoIpBlocked = async (wallet: string, ip: string | undefined): Promise<boolean> => {
    if (geoIpBlockedStates.length === 0) return false;
    if (!ipGeolocationApiKey) return false;
    if (!ip) return false;
    if (!(await Wallet.isGeoIpBlocked(wallet))) return false;

    const res = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${ipGeolocationApiKey}&ip=${ip}&fields=state_code`);
    const {state_code: state} = await res.json();
    return state && geoIpBlockedStates.includes(state.toLowerCase());
};

export function anonymiseIp(ip?: string) {
    return process.env.ANONYMISE_IPS !== "true" ? ip : undefined;
}

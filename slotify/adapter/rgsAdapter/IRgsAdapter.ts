import {Express, Request} from "express";

export interface IRgsAdapter {
    init: (provider: string, api: Express, basePath: string, config: any) => void;
    launch: (mode: "real" | "fun" | "replay", config: any, params: Record<string, string>, req?: Request) => Promise<string>;
}

import * as express from "express";
import * as glob from "glob";

export async function initServices(api: express.Express) {
    if (!process.env.GAMES_SERVICES_PATH) return;

    for (const servicePath of glob.sync(process.env.GAMES_SERVICES_PATH)) {
        const {default: init} = await import(process.cwd() + "/" + servicePath);
        await init?.(api);
    }
}

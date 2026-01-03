import {createService, startService} from "@slotify/shared/lib/api.js";
import express from "express";
import path from "path";
import packageJSON from "./package.json" with {type: "json"};

async function initApi(api: express.Express) {
    api.get("/health", function (_req, res) {
        res.send("OK");
    });

    api.get("/version", function (_req, res) {
        res.send(packageJSON.version);
    });

    api.use("/backoffice", express.static(path.join(path.resolve(), "build")));

    api.get("/*splat", function (_req, res) {
        res.sendFile(path.join(path.resolve(), "build", "index.html"));
    });
}

async function init() {
    const {api} = await createService("backoffice");
    await initApi(api);
    const server = await startService(api);
    return {api, server};
}

export default init();

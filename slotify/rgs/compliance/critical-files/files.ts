import fetch, {fetchAndParse} from "@slotify/shared/lib/fetch";
import Exception from "@slotify/shared/lib/Exception";
import {CriticalFile} from "../../db/model/CriticalFile";
import checksum from "@slotify/shared/lib/checksum";
import wait from "@slotify/shared/lib/wait";
import {gamesServices, getGamesServiceUrl} from "../../util/gamesUtil";
import {getServiceUrl} from "@slotify/shared/lib/urls";

export async function loadFileChecksum(data: CriticalFile) {
    if (data.origin === "local") {
        return await loadLocalServiceFileChecksum(data.service, data.path);
    }
    if (data.origin === "remote") {
        return await loadRemoteFileChecksum(data.path);
    }
    throw new Exception("File has unknown origin");
}

export async function loadLocalServiceFileChecksum(service: string, path: string) {
    let serviceUrl;
    if (gamesServices.indexOf(service) >= 0) {
        serviceUrl = getGamesServiceUrl(service);
    } else {
        serviceUrl = getServiceUrl(service);
    }

    const url = `${serviceUrl}/api/criticalFileChecksum?criticalFilePath=${path}`;

    try {
        const data = await callRepeatedly(async () => await fetchAndParse(url, {method: "GET", headers: {"Content-Type": "application/json"}}));
        return data.checksum;
    } catch (e) {
        throw new Exception("Repeated calls to the service failed", {data: {error: e}});
    }
}

export async function loadRemoteFileChecksum(url: string) {
    const parsedUrl = new URL(url);

    const response = await callRepeatedly(async () => await fetch(parsedUrl));

    if (!response?.ok) {
        throw new Error("Network response was not ok");
    }

    const fileContent = await response.buffer();
    return checksum(fileContent);
}

async function callRepeatedly(call: () => Promise<any>) {
    let repeat = 5;
    let response: any = null;
    do {
        try {
            response = await call();
        } catch (e) {
            if (repeat === 0) {
                throw new Exception("Couldn't fetch data from service", {data: {error: e}});
            }
            await wait(5000);
        }
    } while (--repeat >= 0);

    return response;
}

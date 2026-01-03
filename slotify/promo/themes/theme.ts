import {Campaign} from "../db/model/Campaign";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {Theme} from "../db/model/Theme";
import {defaultThemes} from "./defaultThemes";

export async function theme(campaignId: string, language: string, defaultThemeName?: string) {
    const replicaManager = getConnection("replica").manager;

    const {type, themeId} = await replicaManager.findOneByOrFail(Campaign, {campaignId});
    let theme: Theme | null = null;

    if (themeId) {
        theme = await replicaManager.findOneBy(Theme, {themeId});
    }

    if (defaultThemeName && !theme) {
        theme = await replicaManager.findOneBy(Theme, {name: defaultThemeName});
    }

    return {
        translations: {...defaultThemes[type]?.translations[language], ...theme?.translations[language]},
        icons: theme?.icons,
    };
}

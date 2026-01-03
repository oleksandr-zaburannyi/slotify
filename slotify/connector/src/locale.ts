import i18next from "i18next";
import {Connector} from "./Connector";

export default async function initLocale(language: string) {
    const {default: resources} = await import("./locale/resources.json");
    type IResources = keyof typeof resources;

    await i18next.init({
        lng: language.toLowerCase(),
        resources,
        fallbackLng: code => {
            const standardCode = code.replace("_", "-");
            const map: Record<string, IResources> = {
                "nb": "no",
                "cz": "cs",
                "nl-be": "nl",
                "zh-tw": "zh-hant",
                "en-social": "en-sc",
            };
            if (map[standardCode]) return map[standardCode];
            if (resources[standardCode as IResources]) return standardCode;
            if (standardCode.indexOf("-") === 2) return standardCode.substring(0, standardCode.indexOf("-"));
            return "en";
        },
        lowerCaseLng: true,
        load: "currentOnly",
    });
}

export function initFormatters(connector: Connector) {
    i18next.services.formatter!.add("uppercase", value => value.toUpperCase());
    i18next.services.formatter!.add("currency", value => connector.formatCurrency(parseFloat(value)));
}

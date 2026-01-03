import i18next from "i18next";

export const translateKeys = (text: string | {key: string; data: Record<string, string>}) => {
    if (typeof text === "string") return i18next.t(text).toString();
    return i18next.t(text.key, text.data);
};

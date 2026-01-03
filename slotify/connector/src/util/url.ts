export const isValidURL = (url: string) => url.startsWith("http");

export const openURL = (url: string, target: string = "_blank") => {
    if (!isValidURL(url)) {
        throw new Error(`${url} is not a valid URL`);
    }
    window.open(url, target);
};

export const ensureURL = (url: string) => {
    if (!isValidURL(url)) {
        throw new Error(`${url} is not a valid URL`);
    }
    return url;
};

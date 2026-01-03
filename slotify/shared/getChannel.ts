export function getChannel(userAgent: string | undefined): "mobile" | "desktop" | undefined {
    if (!userAgent) return undefined;
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) return "mobile";
    return "desktop";
}

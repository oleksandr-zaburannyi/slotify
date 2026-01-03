const promoIcons: Record<string, Record<string, string>> = {};

export function getPromoIcon(campaignType: string, key: string): string | undefined {
    return promoIcons[campaignType]?.[key];
}

export function updatePromoIcons(campaignType: string, icons: Record<string, string>) {
    promoIcons[campaignType] = icons;
}

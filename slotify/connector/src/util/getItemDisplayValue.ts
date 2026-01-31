export function getItemDisplayValue(prize: any, language?: string): string {
    if (language && prize.translations && prize.translations[language]) {
        return prize.translations[language];
    }
    return prize.value;
}

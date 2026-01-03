export function clearEmpty(obj: any): Record<any, any> {
    const newObj: Record<any, any> = {};
    for (const key in obj) {
        if (obj[key] !== undefined && obj[key] !== null) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}

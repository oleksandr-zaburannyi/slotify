export default function removeUnderscoredKeys(obj: any): any {
    const newObj: any = {};
    for (const i in obj) {
        if (i.charAt(0) !== "_") {
            newObj[i] = obj[i];
        }
    }
    return newObj;
}

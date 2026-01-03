import {QueryDeepPartialEntity} from "typeorm/query-builder/QueryPartialEntity";
import {getConnection} from "./dbOptions";
import Exception from "./Exception";

type Parser<T> = {
    [K in keyof T]?: (column: string) => T[K];
};

const removeQuotationMarks = (str: string) => {
    if (str.charAt(0) === `"` && str.charAt(str.length - 1) === `"`) {
        str = str.substring(1, str.length - 1);
    }
    return str;
};

const revertEscapedCharacters = (str: string) => {
    return str.replace(/\\"/g, `"`).replace(/\\;/g, ";");
};

export async function importCsv<T>(type: new () => T, id: keyof T | null, content: string, parsers: Parser<T>, addCallback: (data: any) => Promise<any> | any, editCallback: (data: any) => Promise<any> | any) {
    let added = 0;
    let edited = 0;
    const ids: any[] = [];
    const entries: QueryDeepPartialEntity<T>[] = [];
    try {
        const [columns, ...data] = content.split("\n").map((row: string) => row.split(/(?<!\\);/)); // split only on non-escaped semicolons
        for (let i = 0; i <= data.length - 1; i++) {
            const item: QueryDeepPartialEntity<T> = {};
            for (let j = 0; j <= columns.length - 1; j++) {
                const column = removeQuotationMarks(columns[j]) as keyof T;
                const parser = parsers[column];
                if (parser !== undefined) {
                    const str = revertEscapedCharacters(removeQuotationMarks(data[i][j]));
                    (item as any)[column] = str ? parser(str) : null;
                }
            }
            entries.push(item);
        }
        for (const entry of entries) {
            if (id && (await getConnection("primary").manager.findOneBy(type, {[id]: (entry as any)[id]} as any))) {
                await editCallback(entry);
                edited++;
            } else {
                const id = await addCallback(entry);
                added++;
                ids.push(id);
            }
        }
    } catch (e) {
        if (added === 0 && edited === 0) {
            throw new Exception("Incorrect CSV data structure", {data: {error: e}});
        }
    }
    return {added, edited, ids};
}

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

export const revertEscapedCharacters = (str: string, isOldFormat: boolean) => {
    if (isOldFormat) {
        return str.replace(/\\"/g, `"`).replace(/\\;/g, ";");
    }
    // RFC 4180: doubled quotes "" represent a single quote
    return str.replace(/""/g, `"`);
};

export const detectSeparator = (firstLine: string): ";" | "," => {
    // Old format uses ";" as separator between quoted fields
    if (/";"/.test(firstLine)) {
        return ";";
    }
    // Old format uses backslash escaping (\; and \")
    // Check for these patterns to handle single-column old format files
    if (/\\[";]/.test(firstLine)) {
        return ";";
    }
    // Default to new format (comma separator, RFC 4180)
    return ",";
};

export const parseCSVLine = (line: string, separator: string): string[] => {
    const fields: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const isOldFormat = separator === ";";

    while (i < line.length) {
        const char = line[i];

        if (!inQuotes) {
            if (char === '"') {
                inQuotes = true;
            } else if (char === separator) {
                fields.push(field);
                field = "";
            } else {
                field += char;
            }
        } else {
            if (isOldFormat && char === "\\" && line[i + 1] === '"') {
                // Old format: backslash-escaped quotes
                field += '\\"';
                i++;
            } else if (isOldFormat && char === "\\" && line[i + 1] === ";") {
                // Old format: backslash-escaped semicolons
                field += "\\;";
                i++;
            } else if (!isOldFormat && char === '"' && line[i + 1] === '"') {
                // RFC 4180: doubled quotes represent escaped quote
                field += '""';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        }
        i++;
    }
    fields.push(field);
    return fields;
};

export async function importCsv<T>(type: new () => T, id: keyof T | null, content: string, parsers: Parser<T>, addCallback: (data: any) => Promise<any> | any, editCallback: (data: any) => Promise<any> | any) {
    let added = 0;
    let edited = 0;
    const ids: any[] = [];
    const entries: QueryDeepPartialEntity<T>[] = [];
    try {
        const lines = content.split("\n").filter(line => line.trim() !== "");
        const separator = detectSeparator(lines[0]);
        const isOldFormat = separator === ";";
        const [columns, ...data] = lines.map((row: string) => parseCSVLine(row, separator));
        for (let i = 0; i <= data.length - 1; i++) {
            const item: QueryDeepPartialEntity<T> = {};
            for (let j = 0; j <= columns.length - 1; j++) {
                const column = removeQuotationMarks(columns[j]) as keyof T;
                const parser = parsers[column];
                if (parser !== undefined) {
                    const str = revertEscapedCharacters(removeQuotationMarks(data[i][j]), isOldFormat);
                    (item as any)[column] = str ? parser(str) : null;
                }
            }
            entries.push(item);
        }
        for (const entry of entries) {
            if (id && (entry as any)[id] && (await getConnection("primary").manager.findOneBy(type, {[id]: (entry as any)[id]} as any))) {
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

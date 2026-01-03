#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import * as cryptoModule from "crypto";

const files: {[key: string]: string} = {
    "isaac.js": "ce8ff50202880282be16cfb8532882b41eea9d5e",
};

const getChecksum = function (file: string): string {
    const content = fs.readFileSync(file);
    return cryptoModule.createHash("sha1").update(content).digest("hex");
};

for (const file of Object.keys(files)) {
    const checksum = getChecksum(path.resolve(process.cwd(), file));
    if (checksum !== files[file]) {
        throw new Error(`Incorrect checksum for file '${file}'. Expected '${files[file]}', received '${checksum}'`);
    }
}

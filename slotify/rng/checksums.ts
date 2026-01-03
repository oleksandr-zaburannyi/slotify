#!/usr/bin/env node

import * as path from "path";
import * as fs from "fs";
import * as cryptoModule from "crypto";

const files: {[key: string]: string} = {
    "isaac.js": "06e1860835984ee3415398c3b2ba7f17a2e224dd",
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

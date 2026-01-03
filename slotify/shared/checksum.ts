import {createHash} from "crypto";

// shasum my-file.ts
// sha1sum my-file.ts
export default function checksum(data: string): string {
    return createHash("sha1").update(data).digest("hex");
}

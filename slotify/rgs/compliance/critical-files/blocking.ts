import {CriticalFile} from "../../db/model/CriticalFile";
import {CriticalFileVerification} from "../../db/model/CriticalFileVerification";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import Exception from "@slotify/shared/lib/Exception";
import cache from "@slotify/shared/lib/cache";

const SYSTEM_BLOCKING_PERIOD = 24 * 60 * 60 * 1000; // 24h

export async function verifyCriticalFileSystemBlocking(criticalFile: CriticalFile, databaseName: "primary" | "replica") {
    if (!criticalFile.blockOnError) {
        return;
    }

    const latestChecksums = await getConnection(databaseName)
        .createQueryBuilder(CriticalFileVerification, "verification")
        .where("verification.fileId = :fileId", {fileId: criticalFile.id})
        .orderBy("verification.createdAt", "DESC")
        .limit(2)
        .getMany();

    if (!latestChecksums.length) {
        return; // no verification available yet
    }

    const latestChecksum = latestChecksums[0];
    if (Date.now() - latestChecksum.createdAt.getTime() > SYSTEM_BLOCKING_PERIOD) {
        throw new Exception("Critical File latest checksum is outdated", {data: latestChecksum});
    }

    // At least one checksum exists from the past 24h
    // If CRON logs checksums correctly, there's 12h for the Provider to fix the checksums inconsistency
    // Manual verification and edge-case moments (with one checksum from last 24h) increase the chance of a system block
    if (latestChecksums.filter(checksum => Date.now() - checksum.createdAt.getTime() <= SYSTEM_BLOCKING_PERIOD).every(verification => verification.loggedChecksum !== verification.declaredChecksum)) {
        throw new Exception("Critical Files checksums mismatch", {data: {criticalFile, latestChecksums}});
    }
}

export const verifyBlockingCriticalFiles = cache(
    5 * 60,
    async () => {
        const criticalFiles = await getConnection("replica").createQueryBuilder(CriticalFile, "criticalFile").getMany();

        for (const criticalFile of criticalFiles) {
            await verifyCriticalFileSystemBlocking(criticalFile, "replica");
        }
    },
    ["criticalFiles"],
);

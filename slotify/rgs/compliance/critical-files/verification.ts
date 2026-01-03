import {CriticalFile} from "../../db/model/CriticalFile";
import logger from "@slotify/shared/lib/logger";
import CriticalFilesEmailBuilder from "./CriticalFilesEmailBuilder";
import {verifyCriticalFileSystemBlocking} from "./blocking";
import Exception from "@slotify/shared/lib/Exception";
import {loadFileChecksum} from "./files";
import {CriticalFileVerification} from "../../db/model/CriticalFileVerification";

async function logCriticalFileChecksum(criticalFile: CriticalFile, emailBuilder?: CriticalFilesEmailBuilder) {
    let criticalFileVerification;
    try {
        const fileChecksum = await loadFileChecksum(criticalFile);
        await CriticalFile.update({id: criticalFile.id}, {loggedChecksum: fileChecksum});
        criticalFileVerification = CriticalFileVerification.save(CriticalFileVerification.create({fileId: criticalFile.id, loggedChecksum: fileChecksum, declaredChecksum: criticalFile.declaredChecksum}));
    } catch (e) {
        logger.warn(`Unable to log current checksums for critical file ${criticalFile.name}, ${criticalFile.component}`, {error: e});
        emailBuilder?.appendCriticalFileLoggingError(criticalFile);
    }

    return criticalFileVerification;
}

export async function verifyCriticalFile(criticalFile: CriticalFile, emailBuilder?: CriticalFilesEmailBuilder) {
    const checksum = await logCriticalFileChecksum(criticalFile, emailBuilder);

    const areChecksumsMatching = checksum && checksum.loggedChecksum === checksum.declaredChecksum;
    if (!areChecksumsMatching) {
        logger.error(`Verification of the critical file ${criticalFile.name}, ${criticalFile.component}`);
        emailBuilder?.appendChecksumsMismatchError(criticalFile, checksum);

        try {
            await verifyCriticalFileSystemBlocking(criticalFile, "primary");
        } catch (e) {
            logger.error(`System blocked on critical file ${criticalFile.name}, ${criticalFile.component}`, {error: e});
            emailBuilder?.appendSystemBlockedEmail();
        }

        throw new Exception("Critical file verification was not successful");
    }
}

export async function verifyCriticalFiles() {
    const criticalFiles = await CriticalFile.find();

    const emailBuilder = new CriticalFilesEmailBuilder();
    let someFileFailed = false;
    for (const criticalFile of criticalFiles) {
        try {
            await verifyCriticalFile(criticalFile, emailBuilder);
        } catch {
            someFileFailed = true;
        }
    }

    if (someFileFailed) {
        emailBuilder.send();
        throw new Exception("Some critical files failed to pass verification");
    }
}

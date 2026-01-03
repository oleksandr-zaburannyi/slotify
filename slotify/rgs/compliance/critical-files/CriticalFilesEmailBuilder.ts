import {CriticalFile} from "../../db/model/CriticalFile";
import {CriticalFileVerification} from "../../db/model/CriticalFileVerification";
import {sendAlert} from "@slotify/shared/lib/sendAlert";

export default class CriticalFilesEmailBuilder {
    errors: string[] = [];

    public appendCriticalFileLoggingError(criticalFile: CriticalFile) {
        this.errors.push(`
        Unable to log current checksums for critical file <b>"${criticalFile.name}"</b> from component <b>"${criticalFile.component}".</b><br/>
        Block on error: ${criticalFile.blockOnError}<br/>`);
    }

    public appendChecksumsMismatchError(criticalFile: CriticalFile, checksum?: CriticalFileVerification) {
        this.errors.push(`
        Verification of the critical file <b>"${criticalFile.name}"</b> from component <b>"${criticalFile.component}"</b> failed.<br/>
        Declared checksum: ${criticalFile.declaredChecksum}<br/>
        Logged checksum: ${checksum?.loggedChecksum}<br/>
        Block on error: ${criticalFile.blockOnError}<br/>`);
    }

    public appendSystemBlockedEmail() {
        this.errors.push(`
        <b>System is now blocked due to this failed verification.</b><br/>`);
    }

    public send() {
        const content = this.errors.join("<br/>") + "<br/><br/><b>Please resolve the listed issues.</b>";
        sendAlert("Critical files verification errors", content);
    }
}

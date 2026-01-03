import {SampleStatistics} from "./statistics";
import {RtpMonitoring} from "../../db/model/RtpMonitoring";
import {sendAlert} from "@slotify/shared/lib/sendAlert";

export default class RtpMonitoringEmailBuilder {
    errors: string[] = [];

    public appendRtpMonitoring(rtpMonitoring: RtpMonitoring, newStatistics: SampleStatistics, marginOfError: number) {
        const gameVariantEntry = `<b>${rtpMonitoring.game}</b>` + (rtpMonitoring.variant ? `, variant <b>${rtpMonitoring.variant}</b>` : "");

        this.errors.push(`
        Game ${gameVariantEntry} RTP is currently outside it's 99.9% confidence interval:<br/>
        Declared RTP: ${rtpMonitoring.declaredRtp}<br/>
        Sample RTP: ${newStatistics.mean}<br/>
        Sample Variance: ${newStatistics.variance}<br/>
        Sample Margin of Error: ${marginOfError}<br/>
        Sample Count: ${newStatistics.count}<br/>
        Date of calculation: ${new Date(Date.now())}<br/>`);
    }

    public trySend() {
        if (this.errors.length) {
            const content = this.errors.join("<br/>") + "<br/><br/><b>Please verify the listed issues.</b>";
            sendAlert("RTP monitoring alert", content);
        }
    }
}

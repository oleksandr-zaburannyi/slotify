import {AuditLog} from "../db/model/AuditLog";
import {LessThan} from "typeorm";

export async function clearAuditLogs() {
    const date = new Date();
    date.setHours(date.getHours() - 24 * 365);
    await AuditLog.delete({date: LessThan(date)});
}

import {AuditLog} from "../db/model/AuditLog";
import {LessThan} from "typeorm";

const AUDIT_LOGS_RETENTION_DAYS: number = parseInt(process.env.AUDIT_LOGS_RETENTION_DAYS || "365", 10);

export async function clearAuditLogs() {
    const date = new Date();
    date.setHours(date.getHours() - 24 * AUDIT_LOGS_RETENTION_DAYS);
    await AuditLog.delete({date: LessThan(date)});
}

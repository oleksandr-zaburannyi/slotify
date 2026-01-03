import {getConnection} from "@slotify/shared/lib/dbOptions";
import logger from "@slotify/shared/lib/logger";

export default async function () {
    const days = process.env.DAYS_TO_ARCHIVE;
    if (!days) return;

    logger.info(`Started archiving items from before ${days} days`);

    const [{transactions, sessions, verifications}] = await getConnection("primary").query(`
        WITH
            -- delete transactions
            transactions_deleted AS (
                DELETE FROM adapter_transaction
                    WHERE adapter_transaction.status IN ('finished', 'cancelled')
                        AND adapter_transaction."createdAt" < now() - INTERVAL '${days} days'
                    RETURNING adapter_transaction.*)
                ,
            -- delete sessions
            sessions_deleted AS (
                DELETE FROM adapter_session
                    WHERE adapter_session.active IS NOT TRUE
                        AND adapter_session."endedAt" < now() - INTERVAL '${days} days'
                    RETURNING adapter_session.*)
                ,
            -- delete round verifications
            verifications_deleted AS (
                DELETE FROM adapter_round_verification
                    WHERE adapter_round_verification."roundId" IN (select "roundId" from transactions_deleted)
                    RETURNING adapter_round_verification.*)
                ,
            -- move transactions
            transactions_archive AS (
                INSERT INTO adapter_transaction_archive (select * from transactions_deleted))
                ,
            -- move sessions
            sessions_archive AS (
                INSERT INTO adapter_session_archive (select * from sessions_deleted))
                ,
            -- move round verifications
            verifications_archive AS (
                INSERT INTO adapter_round_verification_archive (select * from verifications_deleted))

        -- return number of rounds and wagers deleted
        select (select count(*) from transactions_deleted)  as transactions,
               (select count(*) from sessions_deleted)      as sessions,
               (select count(*) from verifications_deleted) as verifications;
    `);

    logger.info(`Archived ${transactions} transactions, ${sessions} sessions and ${verifications} round verifications`);
}

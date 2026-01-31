import {getConnection} from "@slotify/shared/lib/dbOptions";
import logger from "@slotify/shared/lib/logger";

const limit = process.env.ARCHIVE_BATCH_SIZE || "1000";
const days = process.env.DAYS_TO_ARCHIVE;

export async function archiveSessions() {
    if (!days) return;

    logger.info(`Started archiving sessions from before ${days} days`);

    const [{sessions}] = await getConnection("primary").query(`
            WITH
                -- pick sessions to delete
                sessions_to_delete AS (SELECT "sessionId"
                                       FROM adapter_session
                                       WHERE active IS NOT TRUE
                                         AND "endedAt" < now() - INTERVAL '${days} days'
                                       LIMIT ${limit}),
                -- delete sessions
                sessions_deleted AS (
                    DELETE FROM adapter_session
                        USING sessions_to_delete
                        WHERE adapter_session."sessionId" = sessions_to_delete."sessionId"
                        RETURNING adapter_session.*),
                -- move sessions
                sessions_archive AS (
                    INSERT INTO adapter_session_archive (select * from sessions_deleted))

            -- return number of rows deleted
            select (select count(*) from sessions_deleted) as sessions;
        `);

    logger.info(`Archived ${sessions} sessions`);
    return sessions > 0;
}

export async function archiveTransactions() {
    if (!days) return;

    logger.info(`Started archiving transactions from before ${days} days`);

    const [{transactions, verifications}] = await getConnection("primary").query(`
        WITH
            -- pick transactions to delete
            transactions_to_delete AS (SELECT id
                                       FROM adapter_transaction
                                       WHERE status IN ('finished', 'cancelled')
                                         AND "createdAt" < now() - INTERVAL '${days} days'
                                       LIMIT ${limit}),
            -- delete transactions
            transactions_deleted AS (
                DELETE FROM adapter_transaction
                    USING transactions_to_delete
                    WHERE adapter_transaction.id = transactions_to_delete.id
                    RETURNING adapter_transaction.*),

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
            -- move round verifications
            verifications_archive AS (
                INSERT INTO adapter_round_verification_archive (select * from verifications_deleted))

        -- return number of rounds and wagers deleted
        select (select count(*) from transactions_deleted)  as transactions,
               (select count(*) from verifications_deleted) as verifications;
    `);

    logger.info(`Archived ${transactions} transactions and ${verifications} round verifications`);

    return transactions > 0;
}

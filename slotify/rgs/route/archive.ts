import {getConnection} from "@slotify/shared/lib/dbOptions";
import logger from "@slotify/shared/lib/logger";

const limit = process.env.ARCHIVE_BATCH_SIZE || "1000";
const days = process.env.DAYS_TO_ARCHIVE;

export async function archiveSinglePlayer() {
    if (!days) return;

    logger.info(`Started archiving single player from before ${days} days`);

    const [{rounds, wagers}] = await getConnection("primary").query(`
        WITH
            -- pick rounds to delete
            round_to_delete AS (SELECT "roundId"
                                from rgs_round
                                WHERE rgs_round.active IS NOT TRUE
                                  AND rgs_round.status IN ('finished', 'cancelled')
                                  AND rgs_round."createdAt" < now() - INTERVAL '${days} days'
                                LIMIT ${limit}),
            -- delete sessions
            round_deleted AS (
                DELETE FROM rgs_round
                    USING round_to_delete
                    WHERE rgs_round."roundId" = round_to_delete."roundId"
                    RETURNING rgs_round.*)
            ,
            -- delete wagers based on deleted rounds
            wager_deleted AS (
                DELETE FROM rgs_wager
                    WHERE rgs_wager."roundId" IN (select "roundId" from round_deleted)
                    RETURNING rgs_wager.*)
            ,
            -- move rounds to the archive
            round_archive AS (
                INSERT INTO rgs_round_archive (select * from round_deleted))
            ,
            -- move wagers to the archive
            wager_archive AS (
                INSERT INTO rgs_wager_archive (select * from wager_deleted))

        -- return number of rounds and wagers deleted
        select (select count(*) from round_deleted) as rounds,
               (select count(*) from wager_deleted) as wagers;
    `);

    logger.info(`Archived ${rounds} rounds and ${wagers} wagers`);
    return rounds > 0 || wagers > 0;
}

export async function archiveMultiplayer() {
    if (!days) return;

    logger.info(`Started archiving multi player from before ${days} days`);

    const [{commands, draws, draw_wins}] = await getConnection("primary").query(`
            WITH draw_to_delete AS (SELECT "drawId"
                                    from rgs_draw
                                    WHERE rgs_draw.finished IS TRUE
                                      AND rgs_draw."createdAt" < now() - INTERVAL '${days} days'
                                    LIMIT ${limit}),
                 -- delete sessions
                 draw_deleted AS (
                     DELETE FROM rgs_draw
                         USING draw_to_delete
                         WHERE rgs_draw."drawId" = draw_to_delete."drawId"
                         RETURNING rgs_draw.*)
                ,
                 -- delete commands based on deleted draws
                 commands_deleted AS (
                     DELETE FROM rgs_command
                         WHERE rgs_command."drawId" IN (select "drawId" from draw_deleted)
                         RETURNING rgs_command.*)
                ,
                 -- delete draw_wins based on deleted draws
                 draw_wins_deleted AS (
                     DELETE FROM rgs_draw_win
                         WHERE rgs_draw_win."drawId" IN (select "drawId" from draw_deleted)
                         RETURNING rgs_draw_win.*)
                ,
                 -- move draws to archive
                 draw_archive AS (
                     INSERT INTO rgs_draw_archive (select * from draw_deleted))
                ,
                 -- move commands to archive
                 command_archive AS (
                     INSERT INTO rgs_command_archive (select * from commands_deleted))
                ,
                 -- move draw_wins to archive
                 draw_win_archive AS (
                     INSERT INTO rgs_draw_win_archive (select * from draw_wins_deleted))

            -- return number of rounds and wagers deleted
            select (select count(*) from draw_deleted)      as draws,
                   (select count(*) from commands_deleted)  as commands,
                   (select count(*) from draw_wins_deleted) as draw_wins;
        `);

    logger.info(`Archived ${commands} commands, ${draws} draws and ${draw_wins} draw wins`);

    return draws >= limit || commands >= limit || draw_wins >= limit;
}

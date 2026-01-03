import * as process from "process";
import * as CRC32 from "crc-32";
import {DataSource} from "typeorm";
import logger from "./logger";

const MIGRATOR_SALT = 2053462845;

export async function withAdvisoryLock(connection: DataSource, id: string, callback: () => Promise<any>): Promise<boolean> {
    // generate a unique lock name, has to be an integer
    const lockName = CRC32.str(id) * MIGRATOR_SALT;
    const unlock = async () => {
        const [{pg_advisory_unlock: wasLocked}]: [{pg_advisory_unlock: boolean}] = await connection.manager.query(`SELECT pg_advisory_unlock(${lockName})`);

        if (!wasLocked) {
            logger.warn(`Advisory lock was not locked: ${lockName}`);
        }
    };
    let lock = false;
    try {
        // try to acquire a lock
        const [{pg_try_advisory_lock: locked}]: [{pg_try_advisory_lock: boolean}] = await connection.manager.query(`SELECT pg_try_advisory_lock(${lockName})`);
        lock = locked;

        // if already locked, print a warning an exit
        if (!lock) {
            logger.warn(`Failed to get advisory lock: ${lockName}`);
            return false;
        }

        process.on("SIGTERM", unlock);

        // execute our code inside the lock
        await callback();

        return true;
    } finally {
        // if we acquired a lock, we need to unlock it
        if (lock) {
            process.off("SIGTERM", unlock);
            await unlock();
        }
    }
}

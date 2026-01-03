import {closeServer, closeDatabase} from "@slotify/shared/lib/testUtils";
import {closeRedis} from "@slotify/shared/lib/redis";
import {stopScheduler} from "@slotify/shared/lib/scheduler";

export async function cleanupAfterTests() {
    // Order matters! Close in reverse order of initialization

    // 1. Close the server first (stops accepting new connections)
    await closeServer();

    // 2. Clean up scheduled tasks (stops background tasks that might access DB)
    // Using dynamic import to avoid circular dependencies - this module imports from util/scheduledTasks
    // which can cause issues during test cleanup if imported statically
    const {cleanupScheduledTasks} = await import("../util/scheduledTasks");
    await cleanupScheduledTasks();

    // 3. Stop the scheduler (stops background tasks that might access DB)
    stopScheduler();

    // 4. Close database connections
    await closeDatabase();

    // 5. Close Redis connections last
    await closeRedis();
}

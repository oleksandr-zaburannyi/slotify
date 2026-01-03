import * as path from "path";
import dbOptions, {createConnections} from "./dbOptions";

/*
    This script can be run on a service with:
    node node_modules/@slotify/shared/lib/runMigrations.js adapter
    Requires DB environment variables present on the environment, i.e.
    DB_HOST=localhost DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=pass DB_DATABASE=slotify_local DB_PORT=5432 node node_modules/@slotify/shared/lib/runMigrations.js adapter
 */
(async () => {
    const service = process.argv[2] || path.basename(process.cwd());
    await createConnections({
        primary: {...dbOptions(service), migrationsRun: true},
    });
    process.exit(0);
})();

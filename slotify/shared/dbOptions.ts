import {readdirSync} from "fs";
import {DataSource, DataSourceOptions} from "typeorm";
import logger from "./logger";
import * as process from "process";
import {TypeORMLogger} from "./TypeORMLogger";
import {withAdvisoryLock} from "./withAdvisoryLock";
import {retry} from "./retry";

function decode(value: string): string {
    if (value.substring(value.length - 2) === "==") {
        return Buffer.from(value, "base64").toString();
    }
    return value;
}

const dbParams = (): DataSourceOptions => {
    const type = "postgres";
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined;
    const username = decode(process.env.DB_USERNAME || "");
    const password = decode(process.env.DB_PASSWORD || "");
    const database = process.env.DB_DATABASE;
    const migrationsRun = process.env.DB_MIGRATIONS_RUN != "false";
    return {type, host, port, username, password, database, migrationsRun};
};

export async function createDatabase(database: string) {
    const connection = await new DataSource({...dbParams(), database: "postgres"} as DataSourceOptions).initialize();
    if (
        (
            await connection.query(`SELECT *
                                 FROM pg_database
                                 WHERE datname = '${database}'`)
        ).length === 0
    ) {
        await connection.query(`CREATE DATABASE ${database}`);
        await connection.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        // await connection.query(`grant ALL on ALL tables in schema public to ${username}`);
        // await connection.query(`grant ALL on ALL sequences in schema public to ${username}`);
    }
    await connection.destroy();
}

export async function dropDatabase(database: string) {
    const connection = await new DataSource({...dbParams(), database: "postgres"} as DataSourceOptions).initialize();
    if (
        (
            await connection.query(`SELECT *
                                 FROM pg_database
                                 WHERE datname = '${database}'`)
        ).length > 0
    ) {
        await connection.query(`DROP DATABASE ${database}`);
    }
    await connection.destroy();
}

export default function dbOptions(name: string): DataSourceOptions {
    const extension = process.argv0 === "node" && !process.argv[0].includes(".bin/ts-node") && !process.env.DB_FOLDER_PATH ? ".js" : ".ts";
    const path = process.env.DB_FOLDER_PATH || (process.argv0 === "node" && !process.argv[0].includes(".bin/ts-node") ? process.cwd() + "/lib" : ".");
    return {
        ...dbParams(),
        entities: readdirSync(path + "/db/model")
            .filter(file => file.indexOf(".test.") < 0 && file.indexOf(extension) >= 0)
            .map(file => path + "/db/model/" + file),
        synchronize: false,
        entityPrefix: name + "_",
        migrationsTableName: name + "_migration",
        migrations: [path + "/db/migration/*" + extension],
        migrationsTransactionMode: "each",
        logger: new TypeORMLogger(true),
        poolErrorHandler: err => {
            logger.error(err);
        },
    } as DataSourceOptions;
}

const connections: Record<string, DataSource> = {};

export async function createConnections(connectionOptions: Record<string, DataSourceOptions>) {
    for (const [name, options] of Object.entries(connectionOptions)) {
        connections[name] = await new DataSource({...options, migrationsRun: false}).initialize();
        if (options.migrationsRun) {
            const runMigrations = async () => await connections[name].runMigrations({transaction: "each"});
            await retry(
                () => withAdvisoryLock(connections[name], options.entityPrefix || name, runMigrations),
                5 * 60 * 1000,
                () => 1000,
            );
        }
    }
}

export function getConnection(name: string) {
    return connections[name];
}

export function getConnections() {
    return connections;
}

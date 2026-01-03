import {Express} from "express";
import {Server} from "http";
import * as request from "supertest";
import {gql} from "graphql-request";
import {createDatabase, dropDatabase, getConnections} from "./dbOptions";
import * as process from "process";

let server: Server;

export async function createTestDatabase() {
    await createDatabase(process.env.DB_DATABASE!);
}

export async function initService(path: string = "/index"): Promise<Express> {
    const index = await (await import(process.cwd() + path)).default;
    server = index.server;
    return index.api;
}

export async function closeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

export async function closeDatabase() {
    for (const connection of Object.values(getConnections())) {
        await connection.destroy();
    }
    await dropDatabase(process.env.DB_DATABASE!);
}

const tokens: Record<string, string> = {};
export const accountToken = async (api: Express, email: string = "contact@tequity.ventures", password = "admin"): Promise<string> => {
    if (tokens[email + "_" + password]) return tokens[email + "_" + password];

    const res = await request(api)
        .post("/graphql")
        .send({
            query: gql`
                mutation ($email: String!, $password: String!) {
                    login(email: $email, password: $password) {
                        token
                    }
                }
            `,
            variables: {email, password},
        })
        .expect(200);
    tokens[email + "_" + password] = "Bearer " + res.body.data.login?.token;
    return tokens[email + "_" + password];
};

export const graphQlRequest = (api: Express, token: string, query: string, variables: any = {}, account: any = undefined): request.Test => {
    return request(api).post("/graphql").send({query, variables, account}).set("authorization", token);
};

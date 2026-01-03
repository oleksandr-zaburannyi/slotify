import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {gql} from "graphql-request";
import {accountToken, createTestDatabase, graphQlRequest, initService} from "@slotify/shared/lib/testUtils";
import {Express} from "express";
import {setEnvVariables} from "./setEnvVariables";
import {cleanupAfterTests} from "./cleanup";

let api: Express;
beforeAll(async () => {
    setEnvVariables();
    await createTestDatabase();
    api = await initService();
});

afterAll(async () => {
    await cleanupAfterTests();
});

jest.mock("@slotify/shared/lib/mail", () => ({sendMail: jest.fn, initMail: jest.fn}));

const isProduction = process.env.IS_PRODUCTION;
describe("verifier", () => {
    beforeAll(() => {
        process.env.IS_PRODUCTION = "false";
    });
    afterAll(() => {
        process.env.IS_PRODUCTION = isProduction;
    });

    test("verifier", async () => {
        jest.setTimeout(10000);
        const query = gql`
            mutation {
                walletVerifier(key: "test-key", operator: "test-operator", provider: "test-provider", wallet: "demo", game: "test") {
                    summary {
                        failed
                        passed
                    }
                    tests {
                        assertions {
                            message
                            passed
                        }
                        name
                        request {
                            body
                            headers
                            method
                            responseHeaders
                            status
                            text
                            url
                        }
                    }
                }
            }
        `;
        const res = await graphQlRequest(api, await accountToken(api), query, {}).expect(200);
        expect(res.body.data.walletVerifier.summary).toEqual({failed: expect.any(Number), passed: expect.any(Number)});
        expect(res.body.data.walletVerifier.tests).toBeInstanceOf(Array);
    });
});

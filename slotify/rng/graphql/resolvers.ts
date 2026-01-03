import GraphQLJSON, {GraphQLJSONObject} from "graphql-type-json";
import {generate, IColumn, IJoin, IOptions} from "@slotify/shared/lib/graphQLApi";
import * as fs from "fs";
import {RoundRngState} from "../db/model/RoundRngState";
import {RngSeeds} from "../db/model/RngSeeds";
import {lastRngHash} from "../fairness/client/lastRngHash";
import Exception from "@slotify/shared/lib/Exception";

export default {
    JSON: GraphQLJSON,
    JSONObject: GraphQLJSONObject,
    Query: {
        async schema() {
            return fs.readFileSync(process.cwd() + "/graphql/schema.graphql").toString();
        },
        async roundRngStates(_: any, {sort, filter, limit = 10, offset}: IOptions) {
            if (!filter?.find(f => f.field === "roundId")) throw new Exception("This query requires a 'roundId' filter");

            const columns: IColumn[] = [
                {alias: "roundId", sql: "roundRngState.roundId", sort: true, filters: ["EQUAL"]},
                {alias: "clientSeed", sql: "rngSeeds.clientSeed", sort: true, filters: ["EQUAL"]},
                {alias: "serverSeedHash", sql: "rngSeeds.serverSeedHash", sort: true, filters: ["EQUAL"]},
                {alias: "nextServerSeedHash", sql: "rngSeeds.nextServerSeedHash", sort: true, filters: ["EQUAL"]},
                {alias: "serverSeedStatus", sql: "rngSeeds.status", sort: true, filters: ["EQUAL", "NOT_EQUAL", "IN"]},
                {alias: "serverSeed", sql: "CASE WHEN rngSeeds.status='revealed' THEN rngSeeds.serverSeed ELSE NULL END", sort: true, filters: ["EQUAL"]},
                {alias: "nonce", sql: "roundRngState.nonce", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "cursor", sql: "roundRngState.cursor", sort: true, filters: ["EQUAL", "NOT_EQUAL"]},
                {alias: "status", sql: "roundRngState.status", sort: true, filters: ["EQUAL", "NOT_EQUAL", "IN"]},
            ];
            const joins: IJoin[] = [{entity: RngSeeds, alias: "rngSeeds", condition: `"rngSeeds"."seedsId" = "roundRngState"."seedsId"`}];
            return generate(RoundRngState, "roundRngState", joins, columns, sort, filter, Math.min(limit, 1000), offset);
        },
        async lastRngHash(_: any, {roomId}: {roomId: string}) {
            return await lastRngHash(roomId);
        },
    },
};

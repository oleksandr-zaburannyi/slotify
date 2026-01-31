import {buildSchema, GraphQLSchema, print} from "graphql";
import resolvers from "./resolvers";
import fetch from "@slotify/shared/lib/fetch";
import {IAccount} from "@slotify/shared/lib/graphQLApi";
import {AsyncExecutor, getDirectives, MapperKind, mapSchema} from "@graphql-tools/utils";
import {addResolversToSchema} from "@graphql-tools/schema";
import {loadSchema} from "@graphql-tools/load";
import {GraphQLFileLoader} from "@graphql-tools/graphql-file-loader";
import {stitchSchemas} from "@graphql-tools/stitch";
import cache from "@slotify/shared/lib/cache";
import logger from "@slotify/shared/lib/logger";

const fetchGraphQL = async (uri: string, data: any) => {
    const fetchResult = await fetch(uri, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data),
        timeout: 2 * 60 * 1000,
    });
    return await fetchResult.json();
};
const createExecutor = (uri: string, account: IAccount): AsyncExecutor => {
    return async ({document, variables /*, context*/}) => {
        const query = print(document);
        return fetchGraphQL(uri, {query, variables, account});
    };
};

const links = process.env.GRAPHQL_ENDPOINTS ? process.env.GRAPHQL_ENDPOINTS.split(",") : [];

export const getSchemas = cache(60, async (account: IAccount): Promise<GraphQLSchema> => {
    const schemas = [];
    for (const link of links) {
        try {
            const executor = createExecutor(link, account);
            const schema = buildSchema((await fetchGraphQL(link, {query: "{schema}"})).data.schema);
            schemas.push({schema, executor});
        } catch (e) {
            logger.warn(`Couldn't fetch subschema from (${link})`, {data: {link, account, error: e}});
        }
    }

    const localSchema = addResolversToSchema({
        schema: await loadSchema(process.cwd() + "/graphql/schema.graphql", {loaders: [new GraphQLFileLoader()]}),
        resolvers,
    });
    return stitchSchemas({
        subschemas: [localSchema, ...schemas],
        mergeTypes: true,
        mergeDirectives: true,
        subschemaConfigTransforms: [
            subschemaConfig => {
                const schema = mapSchema(subschemaConfig.schema, {
                    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName /*, typeName*/) => {
                        if (fieldName === "schema") return null;

                        const directives = getDirectives(subschemaConfig.schema, fieldConfig);

                        const authDirective = directives.find(directive => directive.name === "auth");
                        const accountPermissions = account ? ["*", ...(account.permissions || [])] : [];
                        if (authDirective && !accountPermissions.includes(authDirective.args!.permission)) {
                            return null;
                        }

                        const logDirective = directives.find(directive => directive.name === "log");
                        if (logDirective) {
                            fieldConfig.extensions = {log: {...logDirective.args}};
                        }
                        return fieldConfig;
                    },
                });
                return {...subschemaConfig, schema};
            },
        ],
    });
});

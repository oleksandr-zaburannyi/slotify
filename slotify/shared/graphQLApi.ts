import {EntityTarget, ObjectLiteral, QueryBuilder} from "typeorm";
import Exception from "./Exception";
import {GraphQLSchema} from "graphql";
import {Handler, Request, Response} from "express";
import {getConnection} from "./dbOptions";
import {createHandler} from "graphql-http/lib/use/express";
import logger from "./logger";
import {ExecutionResult} from "graphql/index";
import {OperationArgs} from "graphql-http/lib/handler";
import {validate} from "uuid";

export interface IOptions {
    offset?: number;
    limit?: number;
    sort?: ISort;
    filter?: IFilter[];
    options?: any;
}

export type IAccount = Partial<{
    email: string;
    permissions: string[];
    rgss: string[];
    providers: string[];
    wallets: string[];
    operators: string[];
    brands: string[];
}>;

export interface IColumn {
    alias: string;
    sql: string;
    group?: boolean;
    join?: string;
    skipSelect?: boolean;

    sort?: boolean;
    filters?: IFilterType[];
    type?: "uuid" | "json";
}

export interface ISort {
    field: string;
    order: "ASC" | "DESC";
}

export type IFilterType = "IN" | "EQUAL" | "NOT_EQUAL" | "LIKE" | "GREATER" | "GREATER_OR_EQUAL" | "LOWER" | "LOWER_OR_EQUAL" | "NULL" | "NOT_NULL" | "CONTAIN";

export interface IFilter {
    type: IFilterType;
    field: string;
    jsonField?: string;
    value?: string | number | string[] | boolean;
}

export interface IJoin {
    entity: any;
    alias: string;
    condition: string;
}

const maxQueryCost = process.env.MAX_QUERY_COST ? parseInt(process.env.MAX_QUERY_COST, 10) : 500 * 1000;

function createWhere(type: string, column: string, i: number) {
    switch (type.toUpperCase()) {
        case "CONTAIN":
            return `${column}::jsonb ?| array[:...${i}]`;
        case "IN":
            return `${column} IN (:...${i})`;
        case "EQUAL":
            return `${column} = :${i}`;
        case "NOT_EQUAL":
            return `${column} != :${i}`;
        case "LIKE":
            return `${column}::varchar LIKE :${i}`;
        case "GREATER":
            return `${column} > :${i}`;
        case "GREATER_OR_EQUAL":
            return `${column} >= :${i}`;
        case "LOWER":
            return `${column} < :${i}`;
        case "LOWER_OR_EQUAL":
            return `${column} <= :${i}`;
        case "NULL":
            return `${column} is null`;
        case "NOT_NULL":
            return `${column} is not null`;
        default:
            throw new Exception("Unknown filter type");
    }
}

export async function generate(entity: EntityTarget<ObjectLiteral>, alias: string, joins: IJoin[], columns: IColumn[], sort: ISort | undefined, filter: IFilter[] = [], limit: number | undefined, offset = 0) {
    const query = getConnection("replica").createQueryBuilder(entity, alias).select([]);

    //select
    columns.filter(field => !field.skipSelect).forEach(field => query.addSelect(field.sql, field.alias));

    //joins
    joins?.forEach(join => query.leftJoin(join.entity, join.alias, join.condition));

    //filter
    filter.forEach(item => {
        const column = columns.find(column => item.field === column.alias);
        if (!column) {
            throw new Exception(`Not existing filter column '${item.field}'`);
        }
        if (column.filters && !column.filters.includes(item.type)) {
            throw new Exception(`Filter '${item.type}' is not supported on column '${item.field}'.`);
        }
        //validate filter types
        if (column.type === "uuid") {
            const isArrayOfUUIDs = Array.isArray(item.value) && item.value.every(value => validate(value));
            const isUUID = !Array.isArray(item.value) && validate(item.value as string);
            if (!isArrayOfUUIDs && !isUUID) {
                throw new Exception(`Filter on column '${item.field}' should be uuid type.`);
            }
        }
        if (item.type === "IN") {
            if (!Array.isArray(item.value) || item.value.length === 0) {
                throw new Exception("Filter value should be non-empty array.");
            }
        }
    });

    filter.forEach((item, i) => {
        const column = columns.find(column => item.field === column.alias);
        if (column) {
            const columnSql = `(${column.sql})${item.jsonField ? `->>'${item.jsonField.replace(/'/, "")}'` : ""}`;
            query.andWhere(createWhere(item.type, columnSql, i), {[i]: item.value});
        }
    });

    //group by
    columns.filter(field => field.group).forEach(field => query.addGroupBy(field.sql));

    //limit and offset
    if (limit != null) {
        if (limit < 0) throw new Exception("Limit must not be lower than 0");

        query.offset(offset).limit(limit + 1);
    }

    //order
    if (sort) {
        const column = columns.find(column => column.alias === sort.field);
        if (!column) {
            throw new Exception(`Not existing sort column '${sort.field}'`);
        }
        if (column.sort === false) {
            throw new Exception(`Sorting column '${sort.field}' is not allowed.`);
        }
        if (column.type === "json") {
            query.orderBy(`(${column.sql})::varchar`, sort.order);
        } else {
            query.orderBy(column.sql, sort.order);
        }

        const queryCost = await getQueryCost(query);
        if (queryCost > maxQueryCost) {
            throw new Exception(`Sorting column '${sort.field}' is too expensive. Add some filters to limit data scope and retry.`, {data: {query}});
        }
    }

    //meta
    const meta: any = {limit, offset};
    const items = await query.getRawMany();
    meta.hasPrev = offset > 0;
    meta.hasNext = limit != null && items.length > limit;
    if (meta.hasNext) items.pop();

    return {meta, items};
}

async function getQueryCost(query: QueryBuilder<any>): Promise<number> {
    const [sql, params] = query.getQueryAndParameters();
    const explain = await getConnection("replica").query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
    return explain[0]["QUERY PLAN"][0]["Plan"]["Total Cost"];
}

export function graphQLApi(schema: GraphQLSchema, onOperation?: (req: any, args: OperationArgs<any>, result: ExecutionResult) => void): Handler {
    return (req, res, next) => {
        req.setTimeout(4 * 60 * 1000); //4 minutes
        const account = (res as Response).locals?.account || (req as Request).body?.account || {};
        return createHandler({
            schema,
            context: {account, req, res},
            onOperation,
            formatError: err => {
                logger.warn("GraphQL error", err);
                return {message: err.message, name: err.name};
            },
        })(req, res, next);
    };
}

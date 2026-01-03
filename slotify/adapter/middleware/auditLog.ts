import {ExecutionResult, GraphQLSchema, OperationDefinitionNode} from "graphql";
import {AuditLog} from "../db/model/AuditLog";
import {Request} from "express";
import {anonymiseIp} from "../util/ip";
import {Account} from "../db/model/Account";
import {checkIPWhitelisting, getIp} from "@slotify/shared/lib/ip";
import {OperationArgs} from "graphql-http";
import {FieldNode} from "graphql/language/ast";

export function auditLog(schema: GraphQLSchema, req: Request) {
    return async (request: Request, info: OperationArgs<{account: any}>, res: ExecutionResult) => {
        for (const definition of info.document.definitions) {
            for (const selection of (definition as OperationDefinitionNode).selectionSet.selections) {
                const type = (definition as OperationDefinitionNode).operation;
                const action = (selection as FieldNode).name.value;
                const log: any = (type === "query" ? schema.getQueryType() : schema.getMutationType())?.getFields()[action]?.extensions?.log;
                const variables: any = log?.variables ? info.variableValues : null;
                const data: any = res?.data && res?.data[action];
                const query = request.body().query;
                const result = log?.result ? res?.errors || data : null;
                const success = !res.errors;
                const email = info?.contextValue?.account?.email || data?.email || info.variableValues?.email;

                const ip = getIp(req);
                const account = await Account.findOneBy({email});
                const isIpWhitelisted = checkIPWhitelisting(ip, account?.ips || []);
                if (log) {
                    await AuditLog.insert({email, type, action, query, variables, result, success, ip: anonymiseIp(ip), isIpWhitelisted});
                }
            }
        }
    };
}

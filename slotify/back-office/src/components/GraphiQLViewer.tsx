import React, {useMemo} from "react";
import {GraphiQL} from "graphiql";
import {useAppState} from "../lib/AppProvider";
import env from "../lib/env";
import "graphiql/style.css";

const GraphiQLViewer = () => {
    const [state] = useAppState();
    // Memoize fetcher to avoid re-creating on every render
    const fetcher = useMemo(() => {
        return async (
            params: {query: string; variables?: any; operationName?: string | null},
            options?: any, // fallback to any to avoid type errors
        ) => {
            // Support both string and object for headers
            let customHeaders: Record<string, string> = {};
            if (options?.headers) {
                if (typeof options.headers === "string") {
                    try {
                        customHeaders = JSON.parse(options.headers);
                    } catch {
                        // ignore parse errors, fallback to empty
                    }
                } else if (typeof options.headers === "object" && options.headers !== null) {
                    customHeaders = options.headers as Record<string, string>;
                }
            }
            // Always set Authorization if token is present, but allow override from editor
            if (state.token && !customHeaders.authorization) {
                customHeaders.authorization = `Bearer ${state.token}`;
            }
            const body: Record<string, any> = {
                query: params.query,
                variables: params.variables,
            };
            if (params.operationName != null) {
                body.operationName = params.operationName;
            }
            const response = await fetch(`${env.VITE_BO_API_URL}/graphql`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...customHeaders,
                },
                body: JSON.stringify(body),
            });
            return response.json();
        };
    }, [state.token]);

    return (
        <div style={{position: "absolute", top: 20, bottom: 20, left: 20, right: 20}}>
            <GraphiQL fetcher={fetcher} isHeadersEditorEnabled={true} />
        </div>
    );
};
export default GraphiQLViewer;

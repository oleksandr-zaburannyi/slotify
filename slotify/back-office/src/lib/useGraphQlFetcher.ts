import {GraphQLClient} from "graphql-request";
import {useAppState} from "./AppProvider";
import env from "./env";
import {message} from "antd";

let logOutMessage = false;
const useGraphQLFetcher = () => {
    const [state, dispatch] = useAppState();
    const graphQLClient = new GraphQLClient(`${env.VITE_BO_API_URL}/graphql`, {
        headers: state.token ? {authorization: "Bearer " + state.token} : {},
    });
    return ([query, variables]: [string, any]) => {
        return new Promise<any>((resolve, reject) => {
            graphQLClient
                .request(query, variables)
                .then(data => {
                    resolve(data);
                })
                .catch(error => {
                    if (["SESSION_EXPIRED", "ACCESS_DENIED"].includes(error?.response?.error?.code)) {
                        dispatch({type: "loggedOut"});
                        if (!logOutMessage) {
                            logOutMessage = true;
                            const messages: Record<string, string> = {
                                "SESSION_EXPIRED": "Your session expired. You have been logged out.",
                                "ACCESS_DENIED": "You don't have access to the system",
                            };
                            message.warning(messages[error?.response?.error?.code], undefined, () => (logOutMessage = false));
                        }
                    } else {
                        let text = "Couldn't fetch data from the server";
                        if (error?.response?.errors?.length > 0) text = error?.response?.errors[0].message;
                        else if (error?.response?.error?.message) text = error?.response?.error?.message;
                        message.error(text);
                    }
                    reject(error);
                });
        });
    };
};

export default useGraphQLFetcher;

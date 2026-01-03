import {useAppState} from "../../lib/AppProvider";
import {message} from "antd";
import {LogOut} from "react-feather";
import React from "react";
import useGraphQlFetcher from "../../lib/useGraphQlFetcher";
import {gql} from "graphql-request";

const LogOutLink = () => {
    const [, dispatch] = useAppState();
    const fetcher = useGraphQlFetcher();

    return (
        <a
            onClick={() => {
                fetcher([
                    gql`
                        mutation {
                            logout
                        }
                    `,
                    {},
                ])
                    .then(() => {
                        message.info("Logged out successfully");
                    })
                    .finally(() => {
                        dispatch({type: "loggedOut"});
                    });
            }}
        >
            <span className="anticon">
                <LogOut strokeWidth={1} size={16} />
            </span>
            Logout
        </a>
    );
};

export default LogOutLink;

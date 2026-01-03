import React from "react";
import {Layout, Tag, Tooltip} from "antd";
import {BarChart, User} from "react-feather";
import DashHeader from "./styles/Header";
import {Link} from "react-router-dom";
import {useAppState} from "../lib/AppProvider";
import Logo from "./Logo";
import env from "../lib/env";
import LogOutLink from "./styles/LogOutLink";

const MainHeader = () => {
    const [state, dispatch] = useAppState();

    return (
        <DashHeader>
            <Layout.Header>
                {state.mobile && (
                    <button onClick={() => dispatch({type: "mobileDrawer"})} className="trigger">
                        <BarChart size={20} strokeWidth={1} />
                    </button>
                )}
                <Link to="/" className="brand">
                    <Logo height={"35px"} />
                    <strong className="mx-1 text-black">{env.VITE_NAME || "Back Office"}</strong>
                    {env.VITE_ENV && <Tag>{env.VITE_ENV}</Tag>}
                    {env.VITE_IS_PRODUCTION === "true" ? (
                        <Tag color="green">
                            <Tooltip title={"This is a production environment"}>PROD</Tooltip>
                        </Tag>
                    ) : (
                        <Tag color="red">
                            <Tooltip title={"This is a non-production environment"}>DEV</Tooltip>
                        </Tag>
                    )}
                </Link>
                {!state.mobile && state.account && (
                    <div style={{textAlign: "right", width: "100%"}}>
                        <span className="anticon">
                            <User strokeWidth={1} size={16} />
                        </span>{" "}
                        <i>{state.account.email}</i>
                        &nbsp;&nbsp;
                        <LogOutLink />
                    </div>
                )}
            </Layout.Header>
        </DashHeader>
    );
};

export default MainHeader;

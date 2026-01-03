import React from "react";
import {Row} from "antd";
import {Link} from "react-router-dom";
import styled from "styled-components";
import Logo from "./Logo";
import env from "../lib/env";

const Content = styled.div`
    max-width: 400px;
    z-index: 2;
    min-width: 300px;
`;

const LoginContainer = ({children, title}: {children: React.ReactNode; title: string}) => (
    <Row align="middle" justify="center" className="px-3 bg-white mh-page" style={{minHeight: "100vh"}}>
        <Content>
            <div className="text-center mb-5">
                <Link to={"/"}>
                    <Logo height={"100px"} />
                </Link>
                <h5 className="mb-0 mt-3">{title}</h5>
                <p className="text-muted">Welcome to our Back Office</p>
            </div>

            {children}

            <div className="text-center" style={{marginTop: "50px"}}>
                {env.VITE_HIDE_FOOTER !== "true" && (
                    <div className="text-muted text-center">
                        Powered by{" "}
                        <a href={"//tequity.ventures"} rel="noopener noreferrer" target="_blank">
                            <object type="image/svg+xml" data={`/backoffice/logo.svg`} style={{height: 22, marginBottom: -7}} />
                            Tequity
                        </a>
                    </div>
                )}
            </div>
        </Content>
    </Row>
);

export default LoginContainer;

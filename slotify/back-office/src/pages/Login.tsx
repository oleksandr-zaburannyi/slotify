import {gql} from "graphql-request";
import React, {useState} from "react";
import {Button, Form, Input} from "antd";
import {Eye, Mail} from "react-feather";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {useAppState} from "../lib/AppProvider";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import LoginContainer from "../components/LoginContainer";

const Login = () => {
    const [isLoading, setIsLoading] = useState(false);
    const fetcher = useGraphQlFetcher();
    const [, dispatch] = useAppState();

    const location = useLocation();
    const navigate = useNavigate();

    const onFinish = async ({email, password}: any) => {
        setIsLoading(true);
        try {
            const data = await fetcher([
                gql`
                    mutation ($email: String!, $password: String!) {
                        login(email: $email, password: $password) {
                            account {
                                email
                                brands
                                operators
                                rgss
                                providers
                                wallets
                                permissions
                            }
                            services
                            token
                        }
                    }
                `,
                {email, password},
            ]);

            const {token, account, services} = data.login;

            dispatch({type: "loggedIn", data: {token, account, services}});

            setTimeout(() => navigate(location.state.redirectUrl || "/", {replace: true}), 1);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LoginContainer title="Sign in">
            <Form name="basic" layout="vertical" onFinish={onFinish}>
                <Form.Item
                    label="E-mail"
                    name="email"
                    rules={[
                        {required: true, message: "Please input your E-mail!"},
                        {
                            type: "email",
                            message: "The input is not valid E-mail!",
                        },
                    ]}
                >
                    <Input type="email" placeholder="E-mail" prefix={<Mail size={16} strokeWidth={1} style={{color: "rgba(0,0,0,.25)"}} />} />
                </Form.Item>

                <Form.Item label="Password" name="password" rules={[{required: true, message: "Please input your password!"}]}>
                    <Input type="password" placeholder="Password" prefix={<Eye size={16} strokeWidth={1} style={{color: "rgba(0,0,0,.25)"}} />} />
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit" block className="mt-3" disabled={isLoading}>
                        Log in
                    </Button>
                </Form.Item>
            </Form>

            <div className="text-center">
                <small className="text-muted text-center">
                    <Link to="/reset-password">&nbsp;Forgot password?</Link>
                </small>
            </div>
        </LoginContainer>
    );
};

export default Login;

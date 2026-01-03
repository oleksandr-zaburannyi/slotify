import React, {useState} from "react";
import {Button, Form, Input, message} from "antd";
import {Mail} from "react-feather";
import {Link, useNavigate} from "react-router-dom";
import LoginContainer from "../components/LoginContainer";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {gql} from "graphql-request";

const ResetPassword = () => {
    const fetcher = useGraphQlFetcher();
    const location = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const onFinish = async ({email}: any) => {
        setIsLoading(true);
        fetcher([
            gql`
                mutation ($email: String!) {
                    resetPassword(email: $email)
                }
            `,
            {email},
        ])
            .then(() => {
                message.success("Link to reset password sent");
                location("/");
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    return (
        <LoginContainer title="Reset password">
            <Form layout="vertical" onFinish={onFinish}>
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

                <Form.Item>
                    <Button type="primary" htmlType="submit" block disabled={isLoading}>
                        Reset password
                    </Button>
                </Form.Item>

                <div className="text-center">
                    <small className="text-muted text-center">
                        <Link to="/login">&nbsp;Return to login page</Link>
                    </small>
                </div>
            </Form>
        </LoginContainer>
    );
};

export default ResetPassword;

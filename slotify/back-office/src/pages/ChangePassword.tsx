import React, {useEffect, useState} from "react";
import {Button, Form, Input, message} from "antd";
import {Link, useNavigate, useParams} from "react-router-dom";
import LoginContainer from "../components/LoginContainer";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";

const ChangePassword = () => {
    const [, dispatch] = useAppState();
    const fetcher = useGraphQlFetcher();
    const navigate = useNavigate();
    const {key} = useParams<{key: string}>();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        dispatch({type: "loggedOut"});
    }, []);
    const onFinish = async ({password}: any) => {
        setIsLoading(true);
        fetcher([
            gql`
                mutation ($password: String!, $key: String!) {
                    changePassword(password: $password, key: $key) {
                        email
                    }
                }
            `,
            {password, key},
        ])
            .then(() => {
                message.success("Password changed");
                navigate("/login");
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    return (
        <LoginContainer title="Change Password">
            <Form layout="vertical" onFinish={onFinish}>
                <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                        {required: true, message: "Please input your password!"},
                        {min: 6, message: "Password must have at least 6 characters"},
                    ]}
                >
                    <Input.Password />
                </Form.Item>

                <Form.Item
                    name="confirm"
                    label="Confirm Password"
                    dependencies={["password"]}
                    rules={[
                        {required: true, message: "Please confirm your password!"},
                        ({getFieldValue}) => ({
                            validator(_, value) {
                                if (!value || getFieldValue("password") === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error("Passwords do not match!"));
                            },
                        }),
                    ]}
                >
                    <Input.Password />
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

export default ChangePassword;

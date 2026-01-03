import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, Input, message, Modal, Select} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {User} from "react-feather";
import TextArea from "antd/es/input/TextArea";
import JsonView from "react18-json-view";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";

const reports = ["DGE_reports"];
const cronRegExp = /(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7})/;

const SendButton = ({onSuccess, request}: any) => {
    const fetcher = useGraphQlFetcher();
    const handleOnClick = () =>
        Modal.confirm({
            title: "Send report?",
            content: "Are you sure you want to send the report?",
            onOk: () => {
                return new Promise((resolve, reject) => {
                    request(fetcher)
                        .then(() => {
                            message.success("Report send successfully");
                            onSuccess && onSuccess();
                            resolve(false);
                        })
                        .catch(reject);
                });
            },
        });
    return (
        <Button type={"primary"} htmlType="submit" onClick={handleOnClick}>
            Send
        </Button>
    );
};

const Content = () => {
    return (
        <>
            <Form.Item
                label="Cron"
                name="cron"
                rules={[
                    {
                        required: true,
                        type: "string",
                        message: "Incorrect cron value",
                        validator: (rule, value) => {
                            return new Promise((resolve, reject) => {
                                if (cronRegExp.test(value)) {
                                    resolve(null);
                                } else {
                                    reject("Incorrect cron format");
                                }
                            });
                        },
                    },
                ]}
            >
                <Input type="text" placeholder="* * 1 * *" />
            </Form.Item>
            <Form.Item label="Report" name="report" rules={[{required: true, type: "string"}]}>
                <Select placeholder="Report" options={reports.map(value => ({value}))} />
            </Form.Item>
            <Form.Item label="E-mail" name="email" rules={[{type: "email", required: true, message: "Please input your e-mail!"}]}>
                <Input type="text" placeholder="E-mail" autoComplete={"off"} prefix={<User size={16} strokeWidth={1} style={{color: "rgba(0,0,0,.25)"}} />} />
            </Form.Item>
            <Form.Item
                label="Variables"
                name="variables"
                rules={[
                    {
                        required: true,
                        type: "string",
                        validator: (rule, value) => {
                            return new Promise((resolve, reject) => {
                                try {
                                    JSON.parse(value);
                                    resolve(null);
                                } catch {
                                    reject("Incorrect JSON format");
                                }
                            });
                        },
                    },
                ]}
            >
                <TextArea style={{height: 100, fontFamily: "monospace"}} />
            </Form.Item>
            <Form.Item label="Comment" name="comment">
                <Input type="text" placeholder="Comment" autoComplete={"off"} />
            </Form.Item>
        </>
    );
};

const ReportSender = () => {
    const [state] = useAppState();
    const columns: any[] = [
        {title: "Id", dataIndex: "id", hidden: true},
        {title: "Cron", dataIndex: "cron", sorter: true, ...tableFilter("LIKE"), render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Report", dataIndex: "report", sorter: true, ...tableFilter("LIKE")},
        {title: "Email", dataIndex: "email", sorter: true, ...tableFilter("LIKE")},
        {title: "Variables", dataIndex: "variables", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Comment", dataIndex: "comment"},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageReportSender") && (
                        <SendButton
                            onSuccess={refresh}
                            request={(fetcher: any) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            sendReport(id: $id)
                                        }
                                    `,
                                    {id: data.id},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageReportSender") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={{...data, variables: data.variables ? JSON.stringify(data.variables, null, 3) : null}}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: ReportReceiverInput!) {
                                            editReportReceiver(id: $id, data: $data)
                                        }
                                    `,
                                    {data: {...value, variables: value.variables ? JSON.parse(value.variables) : ""}, id: data.id},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageReportSender") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteReportReceiver(id: $id)
                                        }
                                    `,
                                    {id: data.id},
                                ])
                            }
                        />
                    )}
                </>
            ),
        },
    ];

    const dataTable = useRef(null);

    const refresh = () => {
        (dataTable?.current as any)?.revalidate();
    };

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                {state?.account?.permissions?.includes("manageReportSender") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: ReportReceiverInput!) {
                                            addReportReceiver(data: $data)
                                        }
                                    `,
                                    {data: {...data, variables: data.variables ? JSON.parse(data.variables) : null}},
                                ])
                            }
                        />
                    </Form.Item>
                )}
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={refresh}>
                        Refresh
                    </Button>
                </Form.Item>
            </Form>
            <DataTable ref={dataTable} queryName={"reportReceivers"} columns={columns} sort={{field: "id", order: "DESC"}} />
        </>
    );
};
export default ReportSender;

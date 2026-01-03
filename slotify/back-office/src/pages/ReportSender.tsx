import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, DatePicker, Form, Input, message, Select, Space} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {User} from "react-feather";
import TextArea from "antd/es/input/TextArea";
import JsonView from "react18-json-view";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {AppModal} from "../App";
import {getForm} from "../utils/getForm";
import {downloadCSV} from "../components/Buttons/ExportButton";

const reports = ["DGE_reports", "DGE_jackpot"];
const cronRegExp = /(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\d+,)+\d+|(\d+(\/|-)\d+)|\d+|\*) ?){5,7})/;

const SendButton = ({name, onSuccess, request}: any) => {
    const [form] = Form.useForm();
    const fetcher = useGraphQlFetcher();
    const content = (
        <Space.Compact>
            <Form.Item label="Time" name="time">
                <DatePicker showTime={true} />
            </Form.Item>
        </Space.Compact>
    );

    const handleOnClick = () => {
        AppModal().info({
            centered: true,
            width: 400,
            icon: null,
            okText: `${name} report`,
            okCancel: true,
            content: getForm(form, content),
            onOk: async () => {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(async ({time}) => {
                            request(fetcher, time ? new Date(time).getTime() : undefined)
                                .then((data: any) => {
                                    onSuccess && onSuccess(data);
                                    resolve(false);
                                })
                                .catch(reject);
                        })
                        .catch(reject);
                });
            },
        });
    };

    return (
        <Button type={"primary"} htmlType="submit" onClick={handleOnClick}>
            {name}
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
                label="SFTP"
                name="sftp"
                rules={[
                    {
                        required: false,
                        type: "string",
                        validator: (rule, value) => {
                            return new Promise((resolve, reject) => {
                                try {
                                    if (value) {
                                        JSON.parse(value);
                                    }
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
        {title: "SFTP", dataIndex: "sftp", render: (data: any) => data && <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Variables", dataIndex: "variables", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Comment", dataIndex: "comment"},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageReportSender") && (
                        <SendButton
                            name={"Download"}
                            onSuccess={(data: any) => {
                                data.downloadReport.forEach((report: any) => downloadCSV(report.content, report.filename));
                            }}
                            request={(fetcher: any, timestamp?: number) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $timestamp: Float) {
                                            downloadReport(id: $id, timestamp: $timestamp)
                                        }
                                    `,
                                    {id: data.id, timestamp},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageReportSender") && (
                        <SendButton
                            name={"Send"}
                            onSuccess={() => {
                                message.success("Report send successfully");
                            }}
                            request={(fetcher: any, timestamp?: number) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $timestamp: Float) {
                                            sendReport(id: $id, timestamp: $timestamp)
                                        }
                                    `,
                                    {id: data.id, timestamp},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageReportSender") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={{...data, variables: data.variables ? JSON.stringify(data.variables, null, 3) : null, sftp: data.sftp ? JSON.stringify(data.sftp, null, 3) : null}}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: ReportReceiverInput!) {
                                            editReportReceiver(id: $id, data: $data)
                                        }
                                    `,
                                    {data: {...value, variables: value.variables ? JSON.parse(value.variables) : "", sftp: value.sftp ? JSON.parse(value.sftp) : ""}, id: data.id},
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
                                    {data: {...data, variables: data.variables ? JSON.parse(data.variables) : null, sftp: data.sftp ? JSON.parse(data.sftp) : null}},
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

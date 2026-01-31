import React, {useRef} from "react";
import {Link} from "react-router-dom";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, message, Modal} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton} from "../components/Buttons";
import StatusTag from "../components/StatusTag";
import IpAddress from "../components/IpAddress";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import JsonView from "react18-json-view";

const Sessions = () => {
    const [state] = useAppState();
    const dataTable = useRef(null);
    const fetcher = useGraphQlFetcher();

    const columns: any[] = [
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: string) => new Date(createdAt).toLocaleString(), sorter: true, ...tableFilter("TIME")},
        {title: "Last Activity", dataIndex: "lastActivity", render: (lastActivity: string) => new Date(lastActivity).toLocaleString(), sorter: true, ...tableFilter("TIME")},
        {title: "Ended at", dataIndex: "endedAt", render: (endedAt: string) => (endedAt ? new Date(endedAt).toLocaleString() : ""), sorter: true, ...tableFilter("TIME")},
        {title: "Active", dataIndex: "active", sorter: true, render: (value: boolean) => <StatusTag status={value.toString()} />},
        {title: "Session Id", dataIndex: "sessionId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Player Id", dataIndex: "playerId", render: (playerId: string) => <Link to={`/players/${playerId}`}>{playerId}</Link>, sorter: true, ...tableFilter("EQUAL")},
        {title: "Provider", dataIndex: "provider", sorter: true, ...tableFilter("LIKE")},
        {title: "Game", dataIndex: "game", sorter: true, ...tableFilter("LIKE")},
        {title: "Data", dataIndex: "data", render: (data: any) => data && <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "IP", dataIndex: "ip", sorter: true, ...tableFilter("EQUAL"), render: (ip?: string) => <IpAddress ip={ip} />},
        {
            title: "Actions",
            render: ({sessionId, active}: any) =>
                state?.account?.permissions?.includes("endSession") && (
                    <>
                        {active && (
                            <Button
                                size={"small"}
                                onClick={() =>
                                    Modal.confirm({
                                        title: "End session",
                                        content: "Are you sure you want to mark session as ended?",
                                        onOk: () => {
                                            return new Promise((resolve, reject) => {
                                                fetcher([
                                                    gql`
                                                        mutation ($sessionId: ID!) {
                                                            endSession(sessionId: $sessionId)
                                                        }
                                                    `,
                                                    {sessionId},
                                                ])
                                                    .then(() => {
                                                        message.success("Session ended");
                                                        (dataTable?.current as any)?.revalidate();
                                                        resolve(false);
                                                    })
                                                    .catch((error: Error) => {
                                                        message.error(error.message.slice(0, error.message.indexOf(":")));
                                                        reject();
                                                    });
                                            });
                                        },
                                    })
                                }
                            >
                                Mark as ended
                            </Button>
                        )}
                    </>
                ),
        },
    ];

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => (dataTable?.current as any)?.revalidate()}>
                        Refresh
                    </Button>
                </Form.Item>
                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
            </Form>
            <DataTable ref={dataTable} queryName={"sessions"} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};
export default Sessions;

import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, Input, Select, Tag} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {EditButton} from "../components/Buttons";

const Content = () => {
    return (
        <>
            <Form.Item label="Group" name="group">
                <Input type="text" placeholder="Group" />
            </Form.Item>
            <Form.Item label="Blocked" name="blocked" style={{width: "120px"}}>
                <Select>
                    <Select.Option value={true} key={"yes"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={null} key={"no"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>
        </>
    );
};

const Players = () => {
    const [state] = useAppState();
    const dataTable = useRef(null);

    const refresh = () => {
        (dataTable?.current as any)?.revalidate();
    };

    const columns: any[] = [
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: string) => new Date(createdAt).toLocaleString(), sorter: true, ...tableFilter("TIME")},
        {title: "Player Id", dataIndex: "playerId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Native Id", dataIndex: "nativeId", sorter: true, ...tableFilter("STARTS_WITH")},
        {title: "Nickname", dataIndex: "nickname", sorter: true, ...tableFilter("LIKE")},
        {title: "Currency", dataIndex: "currency", sorter: true, ...tableFilter("LIKE")},
        {title: "Wallet", dataIndex: "wallet", sorter: true, ...tableFilter("LIKE")},
        {title: "Operator", dataIndex: "operator", sorter: true, ...tableFilter("LIKE")},
        {title: "Brand", dataIndex: "brand", sorter: true, ...tableFilter("LIKE")},
        {title: "Gender", dataIndex: "gender", sorter: true, ...tableFilter("LIKE")},
        {title: "Country", dataIndex: "country", sorter: true, ...tableFilter("LIKE")},
        {title: "Jurisdiction", dataIndex: "jurisdiction", sorter: true, ...tableFilter("LIKE")},
        {title: "Group", dataIndex: "group", sorter: true, ...tableFilter("LIKE")},
        {title: "Blocked", dataIndex: "blocked", sorter: true, render: (value: boolean) => (value ? <Tag color="red">BLOCKED</Tag> : "")},
        {
            title: "Actions",
            render: ({blocked, playerId, group}: {blocked?: boolean; playerId: string; group?: string}) =>
                state?.account?.permissions?.includes("managePlayers") && (
                    <>
                        <EditButton
                            size={"small"}
                            onSuccess={refresh}
                            content={<Content />}
                            data={{group, blocked}}
                            request={(fetcher, {group, blocked}) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $value: PlayerInput!) {
                                            editPlayer(id: $id, value: $value)
                                        }
                                    `,
                                    {value: {group: group || null, blocked}, id: playerId},
                                ])
                            }
                        />
                    </>
                ),
        },
    ];

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => refresh()}>
                        Refresh
                    </Button>
                </Form.Item>
                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
            </Form>
            <DataTable ref={dataTable} queryName={"players"} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};
export default Players;

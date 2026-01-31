import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, DatePicker, Form, Input, Select, Tooltip} from "antd";
import {InfoCircleOutlined, PlayCircleOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import dayjs from "dayjs";
import StatusTag from "../components/StatusTag";
import SelectAutoComplete from "../components/SelectAutoComplete";

const Content = () => {
    return (
        <>
            <Form.Item label="Start date" name="startsAt">
                <DatePicker showTime />
            </Form.Item>
            <Form.Item label="End date" name="endsAt">
                <DatePicker showTime />
            </Form.Item>
            <Form.Item label="Player Id" name="playerId">
                <Input type="text" placeholder="Player Id" />
            </Form.Item>
            <Form.Item
                label={
                    <>
                        Native Id &nbsp;
                        <Tooltip placement={"left"} overlayStyle={{maxWidth: "300px"}} title={"You can use * character as wildcard"}>
                            <InfoCircleOutlined />
                        </Tooltip>
                    </>
                }
                name="nativeId"
            >
                <Input type="text" placeholder="Native Id" />
            </Form.Item>
            <Form.Item label="Wallet" name="wallet">
                <SelectAutoComplete type={"wallets"} mode={"single"} />
            </Form.Item>
            <Form.Item label="Operator" name="operator">
                <SelectAutoComplete type={"operators"} mode={"single"} />
            </Form.Item>
            <Form.Item label="Brand" name="brand">
                <SelectAutoComplete type={"brands"} mode={"single"} />
            </Form.Item>
            <Form.Item label="Currency" name="currency">
                <SelectAutoComplete type={"currencies"} mode={"single"} />
            </Form.Item>
            <Form.Item label="Inspection exclusion" name="inspection" initialValue={true} rules={[{required: true, message: "Please select"}]} style={{width: "350px"}}>
                <Select style={{width: "100px"}} placeholder="Select">
                    <Select.Option value={true} key={"yes"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={false} key={"no"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="Game win exclusion" name="gameWin" initialValue={true} rules={[{required: true, message: "Please select"}]} style={{width: "350px"}}>
                <Select style={{width: "100px"}} placeholder="Select">
                    <Select.Option value={true} key={"yes"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={false} key={"no"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="Reason" name="reason" rules={[{type: "string"}]}>
                <Input type="text" placeholder="Reason" />
            </Form.Item>
            <Form.Item label="Comment" name="comment" rules={[{type: "string"}]}>
                <Input type="text" placeholder="Comment" />
            </Form.Item>
        </>
    );
};

const ReportExclusion = () => {
    const [state] = useAppState();
    const columns: any[] = [
        {title: "Id", dataIndex: "id", hidden: true},
        {title: "Start date", dataIndex: "startsAt", sorter: true, ...tableFilter("DATE"), render: (date: any) => (date ? new Date(date).toLocaleString() : "")},
        {title: "End date", dataIndex: "endsAt", sorter: true, ...tableFilter("DATE"), render: (date: any) => (date ? new Date(date).toLocaleString() : "")},
        {title: "Player Id", dataIndex: "playerId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Native Id", dataIndex: "nativeId", sorter: true, ...tableFilter("LIKE")},
        {title: "Wallet", dataIndex: "wallet", sorter: true, ...tableFilter("LIKE")},
        {title: "Operator", dataIndex: "operator", sorter: true, ...tableFilter("LIKE")},
        {title: "Brand", dataIndex: "brand", sorter: true, ...tableFilter("LIKE")},
        {title: "Currency", dataIndex: "currency", sorter: true, ...tableFilter("LIKE")},
        {
            title: "Inspection",
            dataIndex: "inspection",
            sorter: true,
            render: (value: boolean) => <StatusTag status={value.toString()} />,
            ...tableFilter("IN", [
                {name: "true", value: true},
                {name: "false", value: false},
            ]),
        },
        {
            title: "Game Win",
            dataIndex: "gameWin",
            sorter: true,
            render: (value: boolean) => <StatusTag status={value.toString()} />,
            ...tableFilter("IN", [
                {name: "true", value: true},
                {name: "false", value: false},
            ]),
        },
        {title: "Comment", dataIndex: "comment", sorter: true, ...tableFilter("LIKE")},
        {title: "Reason", dataIndex: "reason", sorter: true, ...tableFilter("LIKE")},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageReportExclusion") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={{...data, startsAt: data.startsAt ? dayjs(data.startsAt) : null, endsAt: data.endsAt ? dayjs(data.endsAt) : null}}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: ReportExclusionInput!) {
                                            editReportExclusion(id: $id, data: $data)
                                        }
                                    `,
                                    {
                                        data: {...value, startsAt: value.startsAt?.valueOf(), endsAt: value.endsAt?.valueOf()},
                                        id: data.id,
                                    },
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageReportExclusion") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteReportExclusion(id: $id)
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
                {state?.account?.permissions?.includes("manageReportExclusion") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: ReportExclusionInput!) {
                                            addReportExclusion(data: $data)
                                        }
                                    `,
                                    {data: {...data, startsAt: data.startsAt?.valueOf(), endsAt: data.endsAt?.valueOf()}},
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
            <DataTable ref={dataTable} queryName={"reportExclusion"} columns={columns} sort={{field: "id", order: "DESC"}} />
        </>
    );
};

export default ReportExclusion;

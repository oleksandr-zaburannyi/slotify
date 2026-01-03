import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Alert, Button, Form, Input, InputNumber, message, Select, Tooltip} from "antd";
import {InfoCircleOutlined, PlayCircleOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton, ExportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import JsonView from "react18-json-view";
import TextArea from "antd/es/input/TextArea";
import TagList from "../components/TagList";
import StatusTag from "../components/StatusTag";
import {AppModal} from "../App";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";

const Content = ({wallet}: any) => {
    return (
        <>
            <Alert message="Some changes require restarting adapter" type="warning" showIcon style={{marginBottom: 20}} />
            <Form.Item
                label="Id"
                name="id"
                rules={[
                    {required: true, type: "string"},
                    {pattern: /^\S+$/, message: "Spaces are not allowed"},
                ]}
            >
                <Input type="text" placeholder="Id" />
            </Form.Item>
            <Form.Item label="Group" name="group">
                <Input type="text" placeholder="Group" />
            </Form.Item>
            <Form.Item label="Status" name="enabled" rules={[{required: true, message: "Please select"}]} style={{width: "150px"}}>
                <Select style={{width: "100px"}} placeholder="Select">
                    <Select.Option value={true} key={"enabled"}>
                        Enabled
                    </Select.Option>
                    <Select.Option value={false} key={"disabled"}>
                        Disabled
                    </Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="Email" name="email">
                <Input type="text" placeholder="Email" />
            </Form.Item>
            <Form.Item
                label="Adapter"
                name="adapter"
                rules={[
                    {required: true, type: "string"},
                    {pattern: /^\S+$/, message: "Spaces are not allowed"},
                ]}
            >
                <Input type="text" placeholder="Adapter" />
            </Form.Item>
            <Form.Item
                label={
                    <>
                        Key cache expiry (seconds)&nbsp;
                        <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={"In case of authentication with the same key, cached authentication will be used"}>
                            <InfoCircleOutlined />
                        </Tooltip>
                    </>
                }
                name="keyCacheExpiry"
            >
                <InputNumber placeholder="" style={{width: 100}} />
            </Form.Item>
            <Form.Item
                label="Config"
                name="config"
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
            <Form.Item
                label="Inspection config"
                name="inspectionConfig"
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
            <Form.Item label="Parallel transactions" name="parallelTransactions" style={{width: "150px"}}>
                <Select>
                    <Select.Option value={true} key={"yes"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={false} key={"no"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="One-time key blocked" name="oneTimeKeyBlocked" style={{width: "150px"}}>
                <Select>
                    <Select.Option value={true} key={"yes"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={false} key={"no"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="IP blocked" name="ipBlocked" style={{width: "150px"}}>
                <Select>
                    <Select.Option value={true} key={"yes"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={false} key={"no"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="Geo IP blocked" name="geoIpBlocked" style={{width: "150px"}}>
                <Select>
                    <Select.Option value={true} key={"yes"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={false} key={"no"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="Whitelisted IPs" name="ips">
                <Select mode={"tags"} open={false} tokenSeparators={[" ", ","]}>
                    {wallet?.ips?.map((value: string) => (
                        <Select.Option key={value} value={value}>
                            {value}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>
        </>
    );
};

const Wallets = () => {
    const [state] = useAppState();
    const fetcher = useGraphQlFetcher();

    const columns: any[] = [
        {title: "Id", dataIndex: "id", sorter: true, ...tableFilter("LIKE")},
        {title: "Adapter", dataIndex: "adapter", sorter: true, ...tableFilter("LIKE")},
        {title: "Group", dataIndex: "group", sorter: true, ...tableFilter("LIKE")},
        {title: "Status", dataIndex: "enabled", sorter: true, render: (value: boolean) => <StatusTag status={value ? "enabled" : "disabled"} />},
        {title: "Key Cache Expiry", dataIndex: "keyCacheExpiry", sorter: true},
        {title: "Email", dataIndex: "email", sorter: true, ...tableFilter("LIKE")},
        {title: "Config", dataIndex: "config", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Inspection config", dataIndex: "inspectionConfig", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "One-time key blocked", dataIndex: "oneTimeKeyBlocked", sorter: true, render: (value: boolean) => <StatusTag status={value.toString()} />},
        {title: "IP blocked", dataIndex: "ipBlocked", sorter: true, render: (value: boolean) => <StatusTag status={value.toString()} />},
        {title: "Geo IP blocked", dataIndex: "geoIpBlocked", sorter: true, render: (value: boolean) => <StatusTag status={value.toString()} />},
        {title: "Whitelisted IPs", dataIndex: "ips", render: (ips: string[]) => <TagList initialMaxTags={3} tags={ips} />},
        {title: "Parallel transactions", dataIndex: "parallelTransactions", render: (value: string[]) => <StatusTag status={value.toString()} />},
        {
            title: "Actions",
            render: ({id, ...data}: any) => (
                <>
                    {state?.account?.permissions?.includes("manageWallets") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content wallet={data} />}
                            data={{id, ...data, config: JSON.stringify(data.config, null, 2), inspectionConfig: JSON.stringify(data.inspectionConfig, null, 2), ips: data.ips?.length > 0 ? data.ips : undefined}}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: WalletInput!) {
                                            editWallet(id: $id, data: $data)
                                        }
                                    `,
                                    {data: {...data, config: JSON.parse(data.config), inspectionConfig: JSON.parse(data.inspectionConfig), ips: data.ips?.length > 0 ? data.ips : null}, id},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageWallets") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteWallet(id: $id)
                                        }
                                    `,
                                    {id},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageWallets") && (
                        <Button
                            type={"default"}
                            htmlType="submit"
                            onClick={() =>
                                AppModal().confirm({
                                    centered: true,
                                    width: 300,
                                    icon: null,
                                    title: "Reset Inspection",
                                    okText: "Reset",
                                    okCancel: true,
                                    content: (
                                        <>
                                            Reset wallet inspection score? &nbsp;
                                            <Tooltip
                                                placement={"left"}
                                                title={
                                                    "This action will result in resetting inspection score accumulated for the wallet. " +
                                                    "It can be used to prevent frequent blocking of the wallet if the high score was in fact false-positive."
                                                }
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </>
                                    ),
                                    onOk: () =>
                                        fetcher([
                                            gql`
                                                mutation ($id: ID!) {
                                                    resetWalletInspection(id: $id)
                                                }
                                            `,
                                            {id},
                                        ]).then(() => {
                                            message.success("Wallet inspection score reset successfully");
                                        }),
                                })
                            }
                        >
                            Reset Inspection
                        </Button>
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
                {state?.account?.permissions?.includes("manageWallets") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: WalletInput!) {
                                            addWallet(data: $data)
                                        }
                                    `,
                                    {data: {...data, config: JSON.parse(data.config), inspectionConfig: JSON.parse(data.inspectionConfig), ips: data.ips?.length > 0 ? data.ips : null}},
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
                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
            </Form>
            <DataTable ref={dataTable} queryName={"wallets"} columns={columns} />
        </>
    );
};
export default Wallets;

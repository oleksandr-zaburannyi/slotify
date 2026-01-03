import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Alert, Button, Form, Input, Select} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";
import TextArea from "antd/es/input/TextArea";
import TagList from "../components/TagList";
import JsonView from "react18-json-view";

const Content = ({rgs}: any) => {
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
            <Form.Item label="Adapter" name="adapter" rules={[{required: true, type: "string"}]}>
                <Input type="text" placeholder="Adapter" />
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
            <Form.Item label="Whitelisted IPs" name="ips">
                <Select mode={"tags"} open={false} tokenSeparators={[" ", ","]}>
                    {rgs?.ips?.map((value: string) => (
                        <Select.Option key={value} value={value}>
                            {value}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>
        </>
    );
};

const RGSs = () => {
    const [state] = useAppState();

    const columns: any[] = [
        {title: "Id", dataIndex: "id", sorter: true, ...tableFilter("LIKE")},
        {title: "Adapter", dataIndex: "adapter", sorter: true, ...tableFilter("LIKE")},
        {title: "Config", dataIndex: "config", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Inspection config", dataIndex: "inspectionConfig", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Whitelisted IPs", dataIndex: "ips", render: (ips: string[]) => <TagList initialMaxTags={3} tags={ips} />},
        {
            title: "Actions",
            render: ({id, ...data}: any) => (
                <>
                    {state?.account?.permissions?.includes("manageRgss") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content rgs={data} />}
                            data={{id, ...data, config: JSON.stringify(data.config, null, 2), inspectionConfig: JSON.stringify(data.inspectionConfig, null, 2), ips: data.ips?.length > 0 ? data.ips : undefined}}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: RGSInput!) {
                                            editRgs(id: $id, data: $data)
                                        }
                                    `,
                                    {data: {...data, config: JSON.parse(data.config), inspectionConfig: JSON.parse(data.inspectionConfig), ips: data.ips?.length > 0 ? data.ips : null}, id},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageRgss") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteRgs(id: $id)
                                        }
                                    `,
                                    {id},
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
                {state?.account?.permissions?.includes("manageRgss") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: RGSInput!) {
                                            addRgs(data: $data)
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
            <DataTable ref={dataTable} queryName={"rgss"} columns={columns} />
        </>
    );
};
export default RGSs;

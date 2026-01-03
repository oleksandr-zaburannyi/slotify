import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, Input, Select} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {EditButton} from "../components/Buttons";
import StatusTag from "../components/StatusTag";
import JsonView from "react18-json-view";
import TagList from "../components/TagList";
import TextArea from "antd/es/input/TextArea";

const Content = (data: any) => {
    return (
        <>
            <Form.Item label="Feed" name="feed" rules={[{required: true, type: "string"}]}>
                <Input type="text" placeholder="Feed" style={{width: 100}} disabled={true} />
            </Form.Item>
            <Form.Item label="Status" name="enabled" rules={[{required: true, message: "Please select"}]} style={{width: "120px"}}>
                <Select style={{width: "100px"}} placeholder="Select">
                    <Select.Option value={true} key={"enabled"}>
                        Enabled
                    </Select.Option>
                    <Select.Option value={false} key={"disabled"}>
                        Disabled
                    </Select.Option>
                </Select>
            </Form.Item>

            <Form.Item label="Currencies" name="currencies">
                <Select mode={"tags"} open={false} tokenSeparators={[" ", ","]}>
                    {data?.currencies?.map((value: string) => (
                        <Select.Option key={value} value={value}>
                            {value}
                        </Select.Option>
                    ))}
                </Select>
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
        </>
    );
};

const FixedCurrencyRates = () => {
    const [state] = useAppState();
    const columns: any[] = [
        {title: "Feed", dataIndex: "feed", sorter: true, ...tableFilter("LIKE")},
        {title: "Status", dataIndex: "enabled", sorter: true, render: (value: boolean) => <StatusTag status={value ? "enabled" : "disabled"} />},
        {title: "Currencies", dataIndex: "currencies", render: (currencies: string[]) => <TagList initialMaxTags={3} tags={currencies} />, maxWidth: 100},
        {title: "Config", dataIndex: "config", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {!!state?.account?.permissions?.includes("manageCurrencies") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={{...data, config: JSON.stringify(data.config)}}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($feed: String!, $data: CurrencyFeedInput!) {
                                            editCurrencyFeed(feed: $feed, data: $data)
                                        }
                                    `,
                                    {data: {...value, config: JSON.parse(value.config), feed: undefined}, feed: data.feed},
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
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={refresh}>
                        Refresh
                    </Button>
                </Form.Item>
            </Form>
            <DataTable ref={dataTable} queryName={"currencyFeeds"} columns={columns} sort={{field: "feed", order: "ASC"}} />
        </>
    );
};
export default FixedCurrencyRates;

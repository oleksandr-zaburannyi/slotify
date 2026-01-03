import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, DatePicker, Form, Input, InputNumber, message, Space} from "antd";
import {PlayCircleOutlined, RedoOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton, ExportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {AppModal} from "../App";
import {getForm} from "../utils/getForm";

dayjs.extend(utc);

function diff(value: number) {
    if (value === null) return "";
    const formattedValue = (value > 0 ? "+" : "") + (value * 100).toFixed(2) + "%";
    const diff = Math.min(Math.abs(value) * 100 * 255, 255);
    const color = `rgb(${value < 0 ? diff : 0},${value > 0 ? diff : 0},0)`;
    return <span style={{color}}>{formattedValue}</span>;
}

const Fetch = () => {
    const [form] = Form.useForm();
    const fetcher = useGraphQlFetcher();
    const content = (
        <Space.Compact>
            <Form.Item label="Start date" name="date" required={false} rules={[{required: true}]}>
                <DatePicker
                    disabledDate={current => {
                        return current && current > dayjs().startOf("day");
                    }}
                />
            </Form.Item>
        </Space.Compact>
    );
    const handleOnClick = () => {
        AppModal().info({
            centered: true,
            width: 400,
            icon: null,
            okText: "Start",
            okCancel: true,
            content: getForm(form, content),
            onOk: async () => {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(async ({date}) => {
                            fetcher([
                                gql`
                                    mutation ($date: String!) {
                                        fetchCurrencies(date: $date)
                                    }
                                `,
                                {date: date.format("YYYY-MM-DD")},
                            ])
                                .then(() => {
                                    message.success("Fetching currencies has started");
                                    resolve(true);
                                })
                                .catch(reject);
                        })
                        .catch(reject);
                });
            },
        });
    };
    return (
        <Button type={"default"} onClick={handleOnClick} icon={<RedoOutlined />}>
            Fetch
        </Button>
    );
};
const Content = () => {
    return (
        <>
            <Form.Item label="Currency" name="currency" rules={[{required: true, type: "string"}]}>
                <Input type="text" placeholder="Currency" style={{width: 100}} />
            </Form.Item>
            <Form.Item label="Date" name="date" rules={[{required: true}]}>
                <DatePicker picker={"date"} allowClear={false} />
            </Form.Item>
            <Form.Item label="Rate" name="rate" rules={[{required: true, type: "number"}]}>
                <InputNumber type="text" placeholder="Fixed rate" />
            </Form.Item>
        </>
    );
};

const CurrencyExchange = () => {
    const [state] = useAppState();
    const dataTable = useRef(null);

    const columns: any[] = [
        {title: "Id", dataIndex: "id", hidden: true},
        {title: "Date", dataIndex: "date", render: (createdAt: string) => new Date(createdAt).toLocaleDateString(), sorter: true, ...tableFilter("DATE")},
        {title: "Currency", dataIndex: "currency", sorter: true, ...tableFilter("LIKE")},
        {title: "Rate", dataIndex: "rate", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Daily diff", dataIndex: "dailyDiff", sorter: true, render: diff},
        {title: "Monthly diff", dataIndex: "monthlyDiff", sorter: true, render: diff},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {!!state?.account?.permissions?.includes("manageCurrencies") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={{...data, date: dayjs(data.date)}}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: CurrencyExchangeInput!) {
                                            editCurrencyExchange(id: $id, data: $data)
                                        }
                                    `,
                                    {data: {...value, date: value.date.utc().startOf("day")}, id: data.id},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {!!state?.account?.permissions?.includes("manageCurrencies") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteCurrencyExchange(id: $id)
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

    const refresh = () => {
        (dataTable?.current as any)?.revalidate();
    };

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                {state?.account?.permissions?.includes("manageCurrencies") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: CurrencyExchangeInput!) {
                                            addCurrencyExchange(data: $data)
                                        }
                                    `,
                                    {data: {...data, date: data.date.utc().startOf("day")}},
                                ])
                            }
                        />
                    </Form.Item>
                )}
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => (dataTable?.current as any)?.revalidate()}>
                        Refresh
                    </Button>
                </Form.Item>
                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
                {state?.account?.permissions?.includes("manageCurrencies") && (
                    <Form.Item style={{marginBottom: 10}}>
                        <Fetch />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"currencyExchange"} columns={columns} />
        </>
    );
};
export default CurrencyExchange;

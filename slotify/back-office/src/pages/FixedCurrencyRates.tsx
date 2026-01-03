import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, Input, InputNumber} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ImportButton, ExportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";

function getColor(value: number) {
    // Clamp value between -0.5 and 0.5
    value = Math.max(-0.5, Math.min(0.5, value));

    if (value < 0) {
        // Interpolate from green to black
        const intensity = 1 - (value + 0.5) / 0.5; // Normalize to [0,1]
        const g = Math.round(255 * intensity);
        return `rgb(0, ${g}, 0)`;
    } else {
        // Interpolate from black to red
        const intensity = value / 0.5; // Normalize to [0,1]
        const r = Math.round(255 * intensity);
        return `rgb(${r}, 0, 0)`;
    }
}

function diff(value: number) {
    if (value === null) return "";
    const formattedValue = (value > 1 ? "+" : "") + (value * 100).toFixed(2) + "%";
    return <span style={{color: getColor(value)}}>{formattedValue}</span>;
}

const Content = () => {
    return (
        <>
            <Form.Item label="Currency" name="currency" rules={[{required: true, type: "string"}]}>
                <Input type="text" placeholder="Currency" style={{width: 100}} />
            </Form.Item>
            <Form.Item label="Fixed rate" name="fixedRate" rules={[{required: true, type: "number"}]}>
                <InputNumber type="text" placeholder="Fixed rate" />
            </Form.Item>
            <Form.Item label="Decimals" name="decimals" rules={[{required: true, type: "number"}]}>
                <InputNumber type="text" placeholder="Decimal places" step={1} />
            </Form.Item>
            <Form.Item label="Symbol" name="symbol">
                <Input type="text" placeholder="Symbol" style={{width: 100}} />
            </Form.Item>
        </>
    );
};

const FixedCurrencyRates = () => {
    const [state] = useAppState();
    const columns: any[] = [
        {title: "Currency", dataIndex: "currency", sorter: true, ...tableFilter("LIKE")},
        {title: "Fixed rate", dataIndex: "fixedRate", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Decimals", dataIndex: "decimals", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Symbol", dataIndex: "symbol", sorter: true, ...tableFilter("LIKE")},
        {title: "Latest Exchange Rate", dataIndex: "exchangeRate", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Exchange Rate Diff", dataIndex: "exchangeRateDiff", sorter: true, render: diff},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {!!state?.account?.permissions?.includes("manageCurrencies") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={data}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($currency: ID!, $data: FixedCurrencyRateInput!) {
                                            editFixedCurrencyRate(currency: $currency, data: $data)
                                        }
                                    `,
                                    {data: value, currency: data.currency},
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
                                        mutation ($currency: ID!) {
                                            deleteFixedCurrencyRate(currency: $currency)
                                        }
                                    `,
                                    {currency: data.currency},
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
                {state?.account?.permissions?.includes("manageCurrencies") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: FixedCurrencyRateInput!) {
                                            addFixedCurrencyRate(data: $data)
                                        }
                                    `,
                                    {data},
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
                {state?.account?.permissions?.includes("manageCurrencies") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importFixedCurrencyRates"} />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"fixedCurrencyRates"} columns={columns} sort={{field: "currency", order: "ASC"}} />
        </>
    );
};
export default FixedCurrencyRates;

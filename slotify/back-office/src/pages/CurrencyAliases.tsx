import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, Input, InputNumber} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton, ImportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";

const Content = () => {
    return (
        <>
            <Form.Item label="Alias" name="alias" rules={[{required: true, type: "string"}]}>
                <Input type="text" placeholder="Alias" />
            </Form.Item>
            <Form.Item label="Currency" name="currency" rules={[{required: true, type: "string"}]}>
                <Input type="text" placeholder="Currency" />
            </Form.Item>
            <Form.Item label="Multiplier" name="multiplier" rules={[{required: true, type: "number"}]}>
                <InputNumber type="text" placeholder="Multiplier" style={{fontFamily: "monospace"}} />
            </Form.Item>
        </>
    );
};

const CurrencyAliases = () => {
    const [state] = useAppState();
    const columns: any[] = [
        {title: "Alias", dataIndex: "alias", sorter: true, ...tableFilter("LIKE")},
        {title: "Currency", dataIndex: "currency", sorter: true, ...tableFilter("LIKE")},
        {title: "Multiplier", dataIndex: "multiplier", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageCurrencies") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={data}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($alias: ID!, $data: CurrencyAliasInput!) {
                                            editCurrencyAlias(alias: $alias, data: $data)
                                        }
                                    `,
                                    {data: value, alias: data.alias},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageCurrencies") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($alias: ID!) {
                                            deleteCurrencyAlias(alias: $alias)
                                        }
                                    `,
                                    {alias: data.alias},
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
                                        mutation ($currencyAlias: CurrencyAliasInput!) {
                                            addCurrencyAlias(data: $currencyAlias)
                                        }
                                    `,
                                    {currencyAlias: data},
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
                        <ImportButton dataTable={dataTable} importMutation={"importCurrencyAliases"} />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"currencyAliases"} columns={columns} />
        </>
    );
};
export default CurrencyAliases;

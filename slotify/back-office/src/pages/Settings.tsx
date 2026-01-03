import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {AutoComplete, Button, Form, Input, InputNumber, Select, Tag, Typography} from "antd";
import {CheckOutlined, PlayCircleOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton, ExportButton, ImportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import TagList from "../components/TagList";
import SelectAutoComplete from "../components/SelectAutoComplete";
import {AppModal} from "../App";

const settings = [
    "minBet",
    "maxBet",
    "maxBonusBet",
    "maxExposure",
    "useExchangeRateBetLimits",
    "defaultBet",
    "gameVariant",
    "availableBets",
    "autoCompleteHours",
    "autoCompleteDisabled",
    "provablyFair",
    "winCap",
    "depositRetries",
    "cancelRetries",
    "retriesExpiryHours",
    "minDecimals",
    "maxDecimals",
    "mainBets",
    "parallelRounds",
    "hidePromoOptOut",
    "closePromoOptOut",
    "gameEnabled",
    "hideCurrencySymbol",
    "useCurrencySymbol",
    "defaultCampaignThemeName",
];

const Content = () => {
    return (
        <>
            <Form.Item label="Priority" name="priority" rules={[{required: true, type: "number"}]}>
                <InputNumber type="text" placeholder="Priority" />
            </Form.Item>
            <Form.Item label="Key" name="key" rules={[{required: true, type: "string"}]}>
                <AutoComplete placeholder="Key" options={settings.map(value => ({value}))} />
            </Form.Item>
            <Form.Item label="Value" name="value" rules={[{required: true, type: "string"}]}>
                <Input type="text" placeholder="Value" style={{fontFamily: "monospace"}} />
            </Form.Item>
            <Form.Item label="Comment" name="comment" rules={[{type: "string"}]}>
                <Input type="text" placeholder="Comment" />
            </Form.Item>
            <Form.Item label="Server only" name="serverOnly" rules={[{required: true, type: "string"}]}>
                <Select placeholder="Server Only">
                    <Select.Option value="true">True</Select.Option>
                    <Select.Option value="false">False</Select.Option>
                </Select>
            </Form.Item>
            <Form.Item label="Wallets" name="wallets">
                <SelectAutoComplete type={"wallets"} mode="tags" />
            </Form.Item>
            <Form.Item label="Operators" name="operators">
                <SelectAutoComplete type={"operators"} mode="tags" />
            </Form.Item>
            <Form.Item label="Brands" name="brands">
                <SelectAutoComplete type={"brands"} mode="tags" />
            </Form.Item>
            <Form.Item label="Providers" name="providers">
                <SelectAutoComplete type={"providers"} mode="tags" />
            </Form.Item>
            <Form.Item label="Games" name="games">
                <SelectAutoComplete type={"games"} mode="tags" />
            </Form.Item>
            <Form.Item label="Jurisdictions" name="jurisdictions">
                <SelectAutoComplete type={"jurisdictions"} mode="tags" />
            </Form.Item>
            <Form.Item label="Currencies" name="currencies">
                <SelectAutoComplete type={"currencies"} mode="tags" />
            </Form.Item>
        </>
    );
};

function removeEmptyArrays(setting: any): any {
    if (!setting.providers || setting.providers.length === 0) delete setting.providers;
    if (!setting.games || setting.games.length === 0) delete setting.games;
    if (!setting.jurisdictions || setting.jurisdictions.length === 0) delete setting.jurisdictions;
    if (!setting.currencies || setting.currencies.length === 0) delete setting.currencies;
    if (!setting.wallets || setting.wallets.length === 0) delete setting.wallets;
    if (!setting.operators || setting.operators.length === 0) delete setting.operators;
    if (!setting.brands || setting.brands.length === 0) delete setting.brands;
    return setting;
}

function nullifyEmptyArrays(setting: any): any {
    if (!setting.providers || setting.providers.length === 0) setting.providers = null;
    if (!setting.games || setting.games.length === 0) setting.games = null;
    if (!setting.jurisdictions || setting.jurisdictions.length === 0) setting.jurisdictions = null;
    if (!setting.currencies || setting.currencies.length === 0) setting.currencies = null;
    if (!setting.wallets || setting.wallets.length === 0) setting.wallets = null;
    if (!setting.operators || setting.operators.length === 0) setting.operators = null;
    if (!setting.brands || setting.brands.length === 0) setting.brands = null;
    return setting;
}

const Settings = () => {
    const [state] = useAppState();
    const columns: any[] = [
        {title: "Id", dataIndex: "id", sorter: true, ...tableFilter("LIKE") /*, hidden: true*/},
        {title: "Setting Id", dataIndex: "settingId", hidden: true},
        {title: "Priority", dataIndex: "priority", sorter: true},
        {title: "Key", dataIndex: "key", sorter: true, ...tableFilter("LIKE")},
        {title: "Comment", dataIndex: "comment", ...tableFilter("LIKE")},
        {title: "Value", dataIndex: "value", sorter: true, ...tableFilter("LIKE"), render: (value: any) => <span style={{fontFamily: "monospace"}}>{value.length > 40 ? value.slice(0, 40) + "..." : value}</span>},
        {title: "Server only", dataIndex: "serverOnly", sorter: true, render: (value: boolean) => <Tag>{value ? "true" : "false"}</Tag>},
        {title: "Wallets", dataIndex: "wallets", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Operators", dataIndex: "operators", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Brands", dataIndex: "brands", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Providers", dataIndex: "providers", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Games", dataIndex: "games", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Jurisdictions", dataIndex: "jurisdictions", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Currencies", dataIndex: "currencies", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageSettings") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content />}
                            data={removeEmptyArrays({...data, serverOnly: data.serverOnly ? "true" : "false"})}
                            request={(fetcher, value) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: SettingInput!) {
                                            editSetting(id: $id, data: $data)
                                        }
                                    `,
                                    {data: nullifyEmptyArrays({...value, serverOnly: value.serverOnly === "true"}), id: data.id},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageSettings") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteSetting(id: $id)
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

    const CheckButton = () => {
        const fetcher = useGraphQlFetcher();
        const [form] = Form.useForm();
        const onCheck = async (data: any) => {
            for (const key in data) {
                if (!data[key]) delete data[key];
            }
            const query = gql`
                query ($provider: String, $game: String, $wallet: String, $operator: String, $brand: String, $jurisdiction: String, $currency: String) {
                    checkSettings(provider: $provider, game: $game, wallet: $wallet, operator: $operator, brand: $brand, jurisdiction: $jurisdiction, currency: $currency) {
                        settings
                    }
                }
            `;
            const res = await fetcher([query, data]);
            const settings = res.checkSettings.settings;
            AppModal().info({
                icon: null,
                content: (
                    <>
                        {Object.keys(settings)
                            .sort()
                            .map((key: string) => (
                                <ul key={key}>
                                    <Typography.Text keyboard>{key}</Typography.Text>:<Typography.Text keyboard>{settings[key]}</Typography.Text>
                                </ul>
                            ))}
                    </>
                ),
            });
        };
        return (
            <Button
                icon={<CheckOutlined />}
                onClick={() =>
                    AppModal().info({
                        icon: null,
                        okCancel: true,
                        cancelText: "Close",
                        onOk: () => {
                            form.submit();
                        },
                        okText: "Check",
                        content: (
                            <Form form={form} onFinish={onCheck} layout={"vertical"}>
                                <Form.Item label="Provider" name="provider">
                                    <SelectAutoComplete type={"providers"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Game" name="game">
                                    <SelectAutoComplete type={"games"} mode={"single"} />
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
                                <Form.Item label="Jurisdiction" name="jurisdiction">
                                    <SelectAutoComplete type={"jurisdictions"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Currency" name="currency">
                                    <SelectAutoComplete type={"currencies"} mode={"single"} />
                                </Form.Item>
                            </Form>
                        ),
                    })
                }
            >
                Check
            </Button>
        );
    };
    const AvailableBetsButton = () => {
        const fetcher = useGraphQlFetcher();
        const [form] = Form.useForm();
        const onCheck = async (data: any) => {
            for (const key in data) {
                if (!data[key]) delete data[key];
            }
            const query = gql`
                query ($currency: String!, $provider: String!, $game: String!, $wallet: String!, $operator: String!, $brand: String, $jurisdiction: String) {
                    availableBets(currency: $currency, provider: $provider, game: $game, wallet: $wallet, operator: $operator, brand: $brand, jurisdiction: $jurisdiction) {
                        bets
                    }
                }
            `;
            const res = await fetcher([query, data]);
            const bets = res.availableBets.bets;
            AppModal().info({
                icon: null,
                width: 600,
                content: (
                    <>
                        {Object.keys(bets).map((key: string) => (
                            <ul key={key}>
                                <Typography.Text keyboard>{key}</Typography.Text>:<Typography.Text keyboard>{bets[key].available.join(", ")}</Typography.Text>
                            </ul>
                        ))}
                    </>
                ),
            });
        };
        return (
            <Button
                icon={<CheckOutlined />}
                onClick={() =>
                    AppModal().info({
                        icon: null,
                        okCancel: true,
                        cancelText: "Close",
                        onOk: () => {
                            form.submit();
                        },
                        okText: "Check",
                        content: (
                            <Form form={form} onFinish={onCheck} layout={"vertical"}>
                                <Form.Item label="Currency" name="currency" required={true}>
                                    <SelectAutoComplete type={"currencies"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Provider" name="provider" required={true}>
                                    <SelectAutoComplete type={"providers"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Game" name="game" required={true}>
                                    <SelectAutoComplete type={"games"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Wallet" name="wallet" required={true}>
                                    <SelectAutoComplete type={"wallets"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Operator" name="operator" required={true}>
                                    <SelectAutoComplete type={"operators"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Brand" name="brand">
                                    <SelectAutoComplete type={"brands"} mode={"single"} />
                                </Form.Item>
                                <Form.Item label="Jurisdiction" name="jurisdiction">
                                    <SelectAutoComplete type={"jurisdictions"} mode={"single"} />
                                </Form.Item>
                            </Form>
                        ),
                    })
                }
            >
                Available Bets
            </Button>
        );
    };

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                {state?.account?.permissions?.includes("manageSettings") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: SettingInput!) {
                                            addSetting(data: $data)
                                        }
                                    `,
                                    {data: nullifyEmptyArrays({...data, serverOnly: data.serverOnly === "true"})},
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
                {state?.account?.permissions?.includes("manageSettings") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importSettings"} />
                    </Form.Item>
                )}
                <Form.Item>
                    <CheckButton />
                </Form.Item>
                {state?.account?.permissions?.includes("availableBets") && (
                    <Form.Item>
                        <AvailableBetsButton />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"settings"} columns={columns} sort={{field: "priority", order: "DESC"}} />
        </>
    );
};
export default Settings;

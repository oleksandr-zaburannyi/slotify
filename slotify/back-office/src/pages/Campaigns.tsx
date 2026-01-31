import React, {useEffect, useRef, useState} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, DatePicker, Divider, Form, Input, message, Modal, Select, Space} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton, ExportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {getForm} from "../utils/getForm";
import StatusTag from "../components/StatusTag";
import {Link} from "react-router-dom";
import {campaignTypes} from "./promo/campaignTypes";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import SelectAutoComplete from "../components/SelectAutoComplete";
import TagList from "../components/TagList";
import dayjs from "dayjs";
import {ITheme} from "./themes/AddThemeButton";

const Content = ({user, campaign, edit, themesRef}: any) => {
    const [type, setType] = useState(campaign?.type);

    const ConfigEdit = type ? campaignTypes[type].configForm : null;
    return (
        <>
            <Space.Compact>
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
                <Form.Item label="Type" name="type" rules={[{required: true, message: "Please input campaign name"}]} style={{width: "200px"}}>
                    <Select style={{width: "180px"}} placeholder="Select campaign type" onChange={type => setType(type)} disabled={edit}>
                        {Object.keys(campaignTypes).map(type => (
                            <Select.Option value={type} key={type}>
                                {campaignTypes[type].name}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item label="Name" name="name" rules={[{required: true, message: "Please input campaign name"}]} style={{width: "295px"}}>
                    <Input type="text" placeholder="My campaign name" disabled={edit} />
                </Form.Item>
            </Space.Compact>

            <Divider>Time period</Divider>
            <Space.Compact>
                <Form.Item label="Start" name="start" style={{width: "50%", marginRight: 20}}>
                    <DatePicker showTime />
                </Form.Item>
                <Form.Item label="End" name="end">
                    <DatePicker showTime />
                </Form.Item>
            </Space.Compact>
            {/*</Tabs.TabPane>*/}

            {/*<Tabs.TabPane tab="Config" key="config">*/}
            <Divider>Config</Divider>
            {!type && "Campaign type was not selected"}
            {type && !ConfigEdit && "No custom config for " + type}
            {ConfigEdit && (
                <Form.Item name={"config"}>
                    <ConfigEdit edit={edit} />
                </Form.Item>
            )}
            {/*</Tabs.TabPane>*/}

            {type && (
                <Form.Item label="Theme" name="themeId" initialValue={campaign?.themeId}>
                    <Select style={{width: "180px"}} placeholder="Select theme" allowClear>
                        {themesRef.current
                            .filter((theme: ITheme) => theme.campaignType === type)
                            .map((theme: ITheme) => (
                                <Select.Option value={theme.themeId} key={theme.themeId}>
                                    {theme.name}
                                </Select.Option>
                            ))}
                    </Select>
                </Form.Item>
            )}

            <Divider>Segmentation</Divider>
            {/*<Tabs.TabPane tab="Targeting" key="targeting">*/}
            <Form.Item label="Providers" name="providers" rules={[{required: !!user.providers}]}>
                <SelectAutoComplete type={"providers"} mode={user.providers ? "multiple" : "tags"} />
            </Form.Item>

            <Form.Item label="Games" name="games">
                <SelectAutoComplete type={"games"} mode={"tags"} />
            </Form.Item>

            <Form.Item label="Wallets" name="wallets" rules={[{required: !!user.wallets}]}>
                <SelectAutoComplete type={"wallets"} mode={user.wallets ? "multiple" : "tags"} />
            </Form.Item>

            <Form.Item label="Operators" name="operators" rules={[{required: !!user.operators}]}>
                <SelectAutoComplete type={"operators"} mode={user.operators ? "multiple" : "tags"} />
            </Form.Item>

            <Form.Item label="Brands" name="brands" rules={[{required: !!user.brands}]}>
                <SelectAutoComplete type={"brands"} mode={user.brands ? "multiple" : "tags"} />
            </Form.Item>

            <Form.Item label="Currencies" name="currencies">
                <SelectAutoComplete type={"currencies"} mode={"tags"} />
            </Form.Item>

            <Form.Item label="Player Ids" name="playerIds">
                <Select mode={"tags"} open={false} tokenSeparators={[" ", ","]} />
            </Form.Item>

            <Form.Item label="Native Ids" name="nativeIds">
                <Select mode={"tags"} open={false} tokenSeparators={[" ", ","]} />
            </Form.Item>
            {/*</Tabs.TabPane>*/}

            {/*</Tabs>*/}
        </>
    );
};

function removeEmptyArrays(campaign: any): any {
    if (!campaign.nativeIds || campaign.nativeIds.length === 0) delete campaign.nativeIds;
    if (!campaign.playerIds || campaign.playerIds.length === 0) delete campaign.playerIds;
    if (!campaign.providers || campaign.providers.length === 0) delete campaign.providers;
    if (!campaign.games || campaign.games.length === 0) delete campaign.games;
    if (!campaign.wallets || campaign.wallets.length === 0) delete campaign.wallets;
    if (!campaign.operators || campaign.operators.length === 0) delete campaign.operators;
    if (!campaign.brands || campaign.brands.length === 0) delete campaign.brands;
    if (!campaign.currencies || campaign.currencies.length === 0) delete campaign.currencies;
    return campaign;
}

function nullifyEmptyArrays(campaigns: any): any {
    if (!campaigns.nativeIds || campaigns.nativeIds.length === 0) campaigns.nativeIds = null;
    if (!campaigns.playerIds || campaigns.playerIds.length === 0) campaigns.playerIds = null;
    if (!campaigns.providers || campaigns.providers.length === 0) campaigns.providers = null;
    if (!campaigns.games || campaigns.games.length === 0) campaigns.games = null;
    if (!campaigns.wallets || campaigns.wallets.length === 0) campaigns.wallets = null;
    if (!campaigns.operators || campaigns.operators.length === 0) campaigns.operators = null;
    if (!campaigns.brands || campaigns.brands.length === 0) campaigns.brands = null;
    if (!campaigns.currencies || campaigns.currencies.length === 0) campaigns.currencies = null;
    return campaigns;
}

function removeAdditionalFields(campaign: any) {
    const {enabled, type, name, start, end, providers, games, wallets, operators, brands, currencies, playerIds, nativeIds, config, themeId} = campaign;
    return {enabled, type, name, start, end, providers, games, wallets, operators, brands, currencies, playerIds, nativeIds, config, themeId};
}

export const EventButton = ({eventName, campaignId, name, content}: {eventName: string; campaignId: string; name: string; content: React.JSX.Element}) => {
    const [form] = Form.useForm();
    const fetcher = useGraphQlFetcher();
    return (
        <Button
            type={"default"}
            htmlType="submit" /*icon={<EditOutlined/>}*/
            onClick={() => {
                Modal.info({
                    /* bodyStyle: {maxHeight: "90vh", overflowY: "auto"},*/ centered: true,
                    width: 800,
                    icon: null,
                    title: name,
                    okText: "Send",
                    okCancel: true,
                    content: getForm(form, content),
                    onOk: async () => {
                        return new Promise((resolve, reject) => {
                            form.validateFields()
                                .then(async value => {
                                    fetcher([
                                        gql`
                                            mutation ($campaignId: ID!, $params: JSON, $eventId: String!, $eventName: String!) {
                                                campaignSystemEvent(campaignId: $campaignId, params: $params, eventId: $eventId, eventName: $eventName)
                                            }
                                        `,
                                        {campaignId, eventName, params: value, eventId: new Date().getTime().toString()},
                                    ])
                                        .then(() => {
                                            message.success("Event sent successfully");
                                            resolve(true);
                                        })
                                        .catch(() => {
                                            reject();
                                        });
                                })
                                .catch(reject);
                        });
                    },
                });
                // form.setFieldsValue(data);
            }}
        >
            {name}
        </Button>
    );
};

const Campaigns = () => {
    const [state] = useAppState();

    const fetcher = useGraphQlFetcher();
    const themesRef = useRef<ITheme[]>([]);
    useEffect(() => {
        fetcher([
            gql`
                query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
                    themes(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
                        items {
                            themeId
                            name
                            campaignType
                            createdAt
                        }
                    }
                }
            `,
            {
                limit: 1000,
                sort: {
                    "field": "createdAt",
                    "order": "DESC",
                },
            },
        ]).then(request => {
            themesRef.current = request.themes.items;
        });
    }, []);

    const columns: any[] = [
        {title: "Created at", dataIndex: "createdAt", sorter: true, ...tableFilter("DATE"), render: (date: any) => (date ? new Date(date).toLocaleString() : "")},
        {title: "Campaign Id", dataIndex: "campaignId", render: (campaignId: string) => <Link to={`/campaigns/${campaignId}`}>{campaignId}</Link>, ...tableFilter("EQUAL")},
        {title: "Status", dataIndex: "enabled", sorter: true, render: (value: boolean) => <StatusTag status={value ? "enabled" : "disabled"} />},
        {
            title: "Type",
            dataIndex: "type",
            ...tableFilter(
                "IN",
                Object.entries(campaignTypes).map(([value, tool]) => ({value, name: tool.name})),
            ),
            render: (type: string) => (campaignTypes[type] ? campaignTypes[type].name : type),
        },
        {title: "Name", dataIndex: "name", ...tableFilter("LIKE")},
        {title: "Start", dataIndex: "start", sorter: true, ...tableFilter("DATE"), render: (date: any) => (date ? new Date(date).toLocaleString() : "")},
        {title: "End", dataIndex: "end", sorter: true, ...tableFilter("DATE"), render: (date: any) => (date ? new Date(date).toLocaleString() : "")},
        {title: "Opt ins", dataIndex: "optIns", sorter: true},
        {title: "Opt outs", dataIndex: "optOuts", sorter: true},
        {title: "Wallets", dataIndex: "wallets", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Operators", dataIndex: "operators", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Brands", dataIndex: "brands", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Currencies", dataIndex: "currencies", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Providers", dataIndex: "providers", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Games", dataIndex: "games", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Player Ids", dataIndex: "playerIds", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Native Ids", dataIndex: "nativeIds", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Config", dataIndex: "config", hidden: true},
        {title: "Wallet Campaign Id", dataIndex: "walletCampaignId", ...tableFilter("LIKE")},
        {title: "Theme", dataIndex: "themeId", render: (themeId: any) => (themesRef.current as any).findLast((theme: any) => theme.themeId === themeId)?.name},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageCampaigns") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content state={state} edit={true} user={removeEmptyArrays(state.account)} campaign={data} themesRef={themesRef} />}
                            data={{...removeEmptyArrays(data), start: data.start ? dayjs(data.start) : null, end: data.end ? dayjs(data.end) : null}}
                            request={(fetcher, campaign) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: CampaignInput!) {
                                            editCampaign(campaignId: $id, data: $data)
                                        }
                                    `,
                                    {
                                        data: {
                                            ...removeAdditionalFields(nullifyEmptyArrays(campaign)),
                                            start: campaign.start?.valueOf() || null,
                                            end: campaign.end?.valueOf() || null,
                                            themeId: campaign.themeId === undefined ? null : campaign.themeId,
                                        },
                                        id: data.campaignId,
                                    },
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageCampaigns") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteCampaign(campaignId: $id)
                                        }
                                    `,
                                    {id: data.campaignId},
                                ])
                            }
                        />
                    )}
                </>
            ),
        },
        {
            title: "Events",
            render: (data: any) => {
                return (
                    <>
                        {state?.account?.permissions?.includes("manageCampaigns") &&
                            campaignTypes[data.type] &&
                            campaignTypes[data.type].events?.map(item => {
                                const Content = item.content;
                                return <EventButton key={item.eventName} eventName={item.eventName} campaignId={data.campaignId} name={item.name} content={<Content config={data.config} />} />;
                            })}
                    </>
                );
            },
        },
    ];

    const dataTable = useRef(null);

    const refresh = () => {
        (dataTable?.current as any)?.revalidate();
    };

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                {state?.account?.permissions?.includes("manageCampaigns") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content state={state} user={state.account} edit={false} themesRef={themesRef} />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: CampaignInput!) {
                                            addCampaign(data: $data)
                                        }
                                    `,
                                    {data: {...removeAdditionalFields(removeEmptyArrays(data)), start: data.start?.valueOf(), end: data.end?.valueOf()}},
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
            <DataTable ref={dataTable} queryName={"campaigns"} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};
export default Campaigns;

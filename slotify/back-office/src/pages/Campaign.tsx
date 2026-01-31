import {Button, Card, Form, message, Modal, Table, Tag} from "antd";
import {gql} from "graphql-request";
import React, {useMemo, useRef, useState} from "react";
import JsonView from "react18-json-view";
import useSWR from "swr";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import StatusTag from "../components/StatusTag";
import {useParams} from "react-router-dom";
import {DataTable, tableFilter} from "../components/DataTable";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton} from "../components/Buttons";
import {campaignTypes} from "./promo/campaignTypes";
import TagList from "../components/TagList";
import Currency from "../components/Currency";
import {useAppState} from "../lib/AppProvider";

const ClearOptOut = ({onSuccess, playerId, campaignId}: any) => {
    const fetcher = useGraphQlFetcher();
    const handleOnClick = () =>
        Modal.confirm({
            title: "Clear Opt out",
            content: "Are you sure you want to clear opt out of this player?",
            onOk: () => {
                return new Promise((resolve, reject) => {
                    fetcher([
                        gql`
                            mutation ($campaignId: ID!, $playerId: String!) {
                                clearOptOut(campaignId: $campaignId, playerId: $playerId)
                            }
                        `,
                        {playerId, campaignId},
                    ])
                        .then(() => {
                            message.success("Opt out cleared");
                            onSuccess && onSuccess();
                            resolve(false);
                        })
                        .catch(reject);
                });
            },
        });
    return (
        <Button type={"default"} htmlType="submit" onClick={handleOnClick} danger size={"small"}>
            Clear Opt Out
        </Button>
    );
};

const Campaign = () => {
    const {id} = useParams<{id: string}>();
    const fetcher = useGraphQlFetcher();
    const [state] = useAppState();
    const variables = useMemo(() => ({campaignId: id}), [id]);
    const queryCampaign = gql`
        query ($campaignId: JSON!) {
            campaigns(filter: [{field: "campaignId", type: EQUAL, value: $campaignId}], sort: {field: "createdAt", order: ASC}) {
                items {
                    campaignId
                    createdAt
                    name
                    walletCampaignId
                    start
                    end
                    optIns
                    optOuts
                    enabled
                    type
                    wallets
                    operators
                    brands
                    currencies
                    providers
                    games
                    playerIds
                    nativeIds
                    config
                    state
                }
            }
        }
    `;
    const {data} = useSWR([queryCampaign, variables], fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});

    const summary = data?.campaigns.items[0] || {};

    const JsonLink: React.FunctionComponent<any> = ({data}) => {
        return (
            <>
                {data && (
                    <button style={{border: "none", cursor: "pointer"}} onClick={() => setJsonModalVisible(data)}>
                        JSON&raquo;
                    </button>
                )}
            </>
        );
    };

    const [jsonModalVisible, setJsonModalVisible] = useState<any>(null);

    const summaryColumns = [
        {dataIndex: "label", key: "label", render: (value: string) => <b>{value}</b>, width: 105},
        {dataIndex: "value", key: "value"},
    ];

    const summaryData = [
        {label: "Created at", value: summary?.createdAt ? new Date(summary.createdAt).toLocaleString() : ""},
        {label: "Campaign Id", value: summary?.campaignId},
        {label: "Status", value: summary?.enabled !== undefined && <StatusTag status={summary?.enabled ? "enabled" : "disabled"} />},
        {label: "Type", value: campaignTypes[summary?.type] ? campaignTypes[summary?.type].name : summary?.type},
        {label: "Name", value: summary?.name},
        {label: "Wallet Campaign Id", value: summary?.walletCampaignId},
        {label: "Start", value: summary?.start ? new Date(summary?.start).toLocaleString() : ""},
        {label: "End", value: summary?.end ? new Date(summary?.end).toLocaleString() : ""},
        {label: "Opt ins", value: summary?.optIns},
        {label: "Opt outs", value: summary?.optOuts},
        {label: "Config", value: <JsonLink data={summary?.config} />},
        {label: "State", value: <JsonLink data={summary?.state} />},
    ];

    const filtersData = [
        {label: "Providers", value: <TagList tags={summary?.providers} />},
        {label: "Games", value: <TagList tags={summary?.games} />},
        {label: "Wallets", value: <TagList tags={summary?.wallets} />},
        {label: "Operators", value: <TagList tags={summary?.operators} />},
        {label: "Brands", value: <TagList tags={summary?.brands} />},
        {label: "Currencies", value: <TagList tags={summary?.currencies} />},
        {label: "Player Ids", value: <TagList tags={summary?.playerIds} />},
        {label: "Native Ids", value: <TagList tags={summary?.nativeIds} />},
    ];

    const campaignPlayersCustom = summary?.type
        ? (campaignTypes[summary?.type] && campaignTypes[summary?.type].playerColumns)?.map((row: any) => ({
              ...row,
              render: (data: any) => row.render({playerState: data.state, config: summary?.config, campaignState: summary?.state}),
          })) || []
        : [];

    const campaignPlayers: any[] = [
        {title: "Updated at", dataIndex: "updatedAt", render: (createdAt: number) => (createdAt ? new Date(createdAt).toLocaleString() : ""), ...tableFilter("DATE")},
        {title: "Player Id", dataIndex: "playerId", ...tableFilter("EQUAL")},
        {title: "Init", dataIndex: "init", sorter: true, render: (value?: boolean) => (value === null ? "" : <Tag color={value ? "green" : "red"}>{value?.toString()}</Tag>)},
        {title: "Opt In", dataIndex: "optIn", sorter: true, render: (value?: boolean) => (value === null ? "" : <Tag color={value ? "green" : "red"}>{value?.toString()}</Tag>)},
        {title: "Finished", dataIndex: "finished", sorter: true, render: (value?: boolean) => (value === null ? "" : <Tag color={value ? "green" : "red"}>{value?.toString()}</Tag>)},
        {title: "Acknowledged", dataIndex: "acknowledged", sorter: true, render: (value?: boolean) => (value === null ? "" : <Tag color={value ? "green" : "red"}>{value?.toString()}</Tag>)},
        ...campaignPlayersCustom,
        {title: "State", dataIndex: "state", render: (state: any) => <JsonLink data={state} />},
        {
            title: "Actions",
            render: ({playerId, optIn}: any) => state?.account?.permissions?.includes("manageCampaigns") && !optIn && <ClearOptOut playerId={playerId} campaignId={id} onSuccess={() => (dataTable?.current as any)?.revalidate()} />,
        },
    ];

    const campaignPrizes: any[] = [
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: number) => (createdAt ? new Date(createdAt).toLocaleString() : ""), ...tableFilter("DATE")},
        {title: "Player Id", dataIndex: "playerId", ...tableFilter("EQUAL")},
        {title: "Type", dataIndex: "type", sorter: true, ...tableFilter("LIKE")},
        {title: "Data", dataIndex: "data", hidden: true},
        {
            title: "",
            render: ({type, data}: any) => {
                switch (type) {
                    case "item":
                        return data.name;
                    case "cash":
                        return (
                            <>
                                <Currency currency={data.currency} amount={data.amount} onlyAmount={!data.currency} />
                                {data.jackpotAmount && (
                                    <>
                                        Jackpot Win <Currency currency={data.jackpotAmount} amount={data.amount} onlyAmount={!data.currency} />
                                    </>
                                )}
                            </>
                        );
                    default:
                        return JSON.stringify(data);
                }
            },
        },
        {title: "Comment", dataIndex: "comment", sorter: true, ...tableFilter("LIKE")},
        {title: "Paid", dataIndex: "paid", sorter: true, render: (value?: boolean) => (value === null ? "" : <Tag color={value ? "green" : "red"}>{value?.toString()}</Tag>)},
    ];

    const campaignLogs: any[] = [
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: number) => (createdAt ? new Date(createdAt).toLocaleString() : ""), ...tableFilter("DATE")},
        {title: "Name", dataIndex: "name", ...tableFilter("LIKE")},
        ...(campaignTypes[summary?.type]?.logColumns || []),
        {title: "Data", dataIndex: "data", render: (data: any) => <JsonLink data={data} />},
    ];

    const dataTable = useRef(null);
    const dataTable2 = useRef(null);
    const dataTable3 = useRef(null);

    const CampaignStatus = summary?.type ? campaignTypes[summary?.type]?.details : null;

    return (
        <>
            <Card title={"Summary"}>
                <Table dataSource={summaryData} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
            </Card>
            &nbsp;
            {CampaignStatus && (
                <Card title={"Details"}>
                    <CampaignStatus type={summary?.type} config={summary?.config} state={summary?.state} />
                </Card>
            )}
            &nbsp;
            <Card title={"Filters"}>
                <Table dataSource={filtersData} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
            </Card>
            &nbsp;
            <Card title={"Players"}>
                <Form layout={"inline"} style={{marginBottom: 20}}>
                    <Form.Item>
                        <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => (dataTable?.current as any)?.revalidate()}>
                            Refresh
                        </Button>
                    </Form.Item>
                    <Form.Item>
                        <ExportButton dataTable={dataTable} />
                    </Form.Item>
                </Form>
                {summary?.campaignId && (
                    <DataTable ref={dataTable} columns={campaignPlayers} sort={{field: "updatedAt", order: "DESC"}} queryName={"campaignPlayers"} filter={[{field: "campaignId", type: "EQUAL", value: summary?.campaignId}]} />
                )}
            </Card>
            <Modal closable={true} open={jsonModalVisible !== null} footer={null} transitionName={""} onCancel={() => setJsonModalVisible(null)} width={"50%"}>
                {jsonModalVisible && (
                    <div style={{overflow: "auto", width: "100%", maxHeight: "calc(100vh - 225px)"}}>
                        <JsonView collapsed={1} enableClipboard={true} src={jsonModalVisible} />
                    </div>
                )}
            </Modal>
            &nbsp;
            <Card title={"Prizes"}>
                <Form layout={"inline"} style={{marginBottom: 20}}>
                    <Form.Item>
                        <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => (dataTable2?.current as any)?.revalidate()}>
                            Refresh
                        </Button>
                    </Form.Item>
                    <Form.Item>
                        <ExportButton dataTable={dataTable2} />
                    </Form.Item>
                </Form>
                {summary?.campaignId && <DataTable ref={dataTable2} columns={campaignPrizes} queryName={"campaignPrizes"} filter={[{field: "campaignId", type: "EQUAL", value: summary?.campaignId}]} />}
            </Card>
            &nbsp;
            <Card title={"Logs"}>
                <Form layout={"inline"} style={{marginBottom: 20}}>
                    <Form.Item>
                        <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => (dataTable3?.current as any)?.revalidate()}>
                            Refresh
                        </Button>
                    </Form.Item>
                    <Form.Item>
                        <ExportButton dataTable={dataTable3} />
                    </Form.Item>
                </Form>
                {summary?.campaignId && <DataTable ref={dataTable3} columns={campaignLogs} queryName={"campaignLogs"} filter={[{field: "campaignId", type: "EQUAL", value: summary?.campaignId}]} />}
            </Card>
        </>
    );
};
export default Campaign;

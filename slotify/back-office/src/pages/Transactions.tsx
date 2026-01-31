import {Button, Form, Switch, Tag} from "antd";
import React, {useRef, useState} from "react";
import {Link} from "react-router-dom";
import {DataTable, tableFilter} from "../components/DataTable";
import StatusTag from "../components/StatusTag";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton} from "../components/Buttons";
import env from "../lib/env";
import IpAddress from "../components/IpAddress";
import Currency from "../components/Currency";
import {campaignTypes} from "./promo/campaignTypes";
import JsonView from "react18-json-view";

const Transactions = () => {
    const initialValues = {convert: false};
    const dataTable = useRef(null);
    const [params, setParams] = useState<typeof initialValues>(initialValues);

    const columns: any[] = [
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: string) => new Date(createdAt).toLocaleString(), sorter: true, ...tableFilter("TIME")},
        {title: "Finished at", dataIndex: "finishedAt", render: (finishedAt: string) => (finishedAt ? new Date(finishedAt).toLocaleString() : ""), sorter: true, ...tableFilter("TIME")},
        // {title: "Cancelled at", dataIndex: "cancelledAt", render: (cancelledAt: string) => cancelledAt ? new Date(cancelledAt).toLocaleString() : "", sorter: true, ...tableFilter("TIME")},
        {title: "Round Id", dataIndex: "roundId", render: (roundId: string) => <Link to={`/rounds/${roundId}`}>{roundId}</Link>, sorter: true, ...tableFilter("EQUAL")},
        {title: "Transaction Id", dataIndex: "transactionId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Session Id", dataIndex: "sessionId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Player Id", dataIndex: "playerId", render: (playerId: string) => <Link to={`/players/${playerId}`}>{playerId}</Link>, sorter: true, ...tableFilter("EQUAL")},
        {title: "Native Id", dataIndex: "nativeId", sorter: true, ...tableFilter("STARTS_WITH")},
        {
            title: "Type",
            dataIndex: "type",
            sorter: true,
            ...tableFilter("IN", [
                {name: "withdraw", value: "withdraw"},
                {name: "deposit", value: "deposit"},
            ]),
            render: (status: string) => <StatusTag status={status} />,
        },
        {title: "Amount", dataIndex: "amount", sorter: true, render: (_: any, item: any) => <Currency currency={item.currency} amount={item.amount} />},
        {title: "Jackpot amount", dataIndex: "jackpotAmount", sorter: true, render: (_: any, item: any) => <Currency currency={item.currency} amount={item.jackpotAmount} />},
        {title: "Balance after", dataIndex: "balanceAfter", sorter: true, render: (_: any, item: any) => <Currency currency={item.currency} amount={item.balanceAfter} />},
        {title: "Currency", dataIndex: "currency", sorter: true, ...tableFilter("LIKE")},
        {
            title: "Round finished",
            dataIndex: "roundFinished",
            render: (finished: boolean) => <Tag color={finished ? "green" : "lightgrey"}>{finished ? "true" : "false"}</Tag>,
            sorter: true,
            ...tableFilter("IN", [
                {name: "true", value: true},
                {name: "false", value: false},
            ]),
        },
        {title: "Auto", dataIndex: "auto", render: (finished: boolean) => <Tag color={finished ? "green" : "lightgrey"}>{finished ? "true" : "false"}</Tag>, sorter: true},
        {
            title: "Status",
            dataIndex: "status",
            sorter: true,
            ...tableFilter(
                "IN",
                ["started", "finished", "failed", "cancel", "cancelled", "rejected", "voided"].map(name => ({name, value: name})),
            ),
            render: (_: any, {status, failReason}: any) => <StatusTag key={status} status={status} comment={failReason} />,
        },
        {title: "Fail reason", dataIndex: "failReason", hidden: true},
        {title: "Category", dataIndex: "category", sorter: true, ...tableFilter("EQUAL")},
        {title: "Name", dataIndex: "name", sorter: true, ...tableFilter("EQUAL")},
        {title: "RGS", dataIndex: "rgs", sorter: true, ...tableFilter("LIKE")},
        {title: "RGS Transaction Id", dataIndex: "rgsTransactionId", sorter: true, ...tableFilter("EQUAL")},
        {title: "RGS Round Id", dataIndex: "rgsRoundId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Provider", dataIndex: "provider", sorter: true, ...tableFilter("LIKE")},
        {title: "Game", dataIndex: "game", sorter: true, ...tableFilter("LIKE")},
        {title: "Variant", dataIndex: "variant", sorter: true, ...tableFilter("LIKE")},
        {title: "Channel", dataIndex: "channel", sorter: true, ...tableFilter("LIKE")},
        {title: "Wallet", dataIndex: "wallet", sorter: true, ...tableFilter("LIKE")},
        {title: "Operator", dataIndex: "operator", sorter: true, ...tableFilter("LIKE")},
        {title: "Brand", dataIndex: "brand", sorter: true, ...tableFilter("LIKE")},
        {title: "Jurisdiction", dataIndex: "jurisdiction", sorter: true, ...tableFilter("LIKE")},
        {
            title: "Campaign type",
            dataIndex: "campaignType",
            sorter: true,
            ...tableFilter(
                "IN",
                Object.entries(campaignTypes).map(([value, tool]) => ({value, name: tool.name})),
            ),
            render: (type: string) => (campaignTypes[type] ? campaignTypes[type].name : type),
        },
        {title: "Campaign Id", dataIndex: "campaignId", sorter: true, ...tableFilter("EQUAL"), render: (campaignId: string) => <Link to={`/campaigns/${campaignId}`}>{campaignId}</Link>},
        {title: "Wallet Campaign Id", dataIndex: "walletCampaignId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Campaign Data", dataIndex: "campaignData", render: (data: any) => data && <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "IP", dataIndex: "ip", sorter: true, ...tableFilter("EQUAL"), render: (ip?: string) => <IpAddress ip={ip} />},
        {title: "Score", dataIndex: "verificationScore", sorter: true, render: (value: any) => value !== null && <span style={{fontFamily: "monospace"}}>{value} points</span>},
        {
            title: "Verification",
            dataIndex: "verificationAction",
            sorter: true,
            render: (value: string | null) => value !== null && <StatusTag status={value} />,
            ...tableFilter("IN", [
                {name: "passed", value: "passed"},
                {name: "alerted", value: "alerted"},
                {name: "rejected", value: "rejected"},
            ]),
        },
    ];

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => (dataTable?.current as any)?.revalidate()}>
                        Refresh
                    </Button>
                </Form.Item>
                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
                <Form.Item style={{marginBottom: 10}} label={`Convert to ${env.VITE_BASE_CURRENCY.toUpperCase()}`} name="convert" valuePropName="checked" initialValue={initialValues.convert}>
                    <Switch
                        style={{width: 40}}
                        onChange={convert => {
                            setParams({convert});
                        }}
                    />
                </Form.Item>
            </Form>
            <DataTable ref={dataTable} queryName={"transactions"} options={{convert: params.convert}} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};
export default Transactions;

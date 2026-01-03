import env from "../../lib/env";
import {Alert, Form, Input, Space, Table} from "antd";
import React, {useEffect, useState} from "react";
import {ConfigProps, ICampaignType} from "./campaignTypes";
import SelectAutoComplete from "../../components/SelectAutoComplete";
import Currency from "../../components/Currency";

type IConfig = {amount?: number; bets?: number; currency?: string};
type ICampaignState = any;

type IFreeBetsDetails = {config?: IConfig; state?: ICampaignState};

export const FreeBetsDetails = ({config}: IFreeBetsDetails) => {
    const summaryColumns = [
        {dataIndex: "label", key: "label", render: (value: string) => <b>{value}</b>, width: 125},
        {dataIndex: "value", key: "value"},
    ];

    const currency = config?.currency || env.VITE_BASE_CURRENCY;
    const data = [
        {label: "Bets per player", value: config?.bets},
        {label: "Bet amount", value: config?.amount ? <Currency currency={currency} amount={config.amount} onlyAmount={false} /> : ""},
    ];

    return <Table dataSource={data} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />;
};

export const FreeBetsConfig: React.FC<ConfigProps<IConfig>> = ({value, onChange}) => {
    const [data, setData] = useState(value || {});
    useEffect(() => {
        onChange!(data);
    }, [data]);

    return (
        <>
            <Alert message="Bet amount will be automatically converted from specified currency to player currency" type="info" showIcon style={{marginBottom: 20}} />
            <Space.Compact>
                <Form.Item initialValue={value?.amount} label={`Bet amount`} name="amount" rules={[{required: true, message: "Please input bet amount"}]} style={{width: 220}}>
                    <Input type="number" min={0} step={0.1} onChange={e => setData({...data, amount: parseFloat(e.target.value)})} style={{width: 150}} />
                </Form.Item>
                <Form.Item initialValue={value?.currency} label="Currency" name="currency" style={{width: 160, marginRight: 100}} rules={[{required: true, message: "Please select currency"}]}>
                    <SelectAutoComplete type={"currencies"} mode={"single-select"} onChange={currency => setData({...data, currency})} />
                </Form.Item>
                <Form.Item initialValue={value?.bets} label="Bets per player" name="bets" rules={[{required: true, message: "Please input bets per player"}]} style={{width: 220}}>
                    <Input type="number" min={1} onChange={e => setData({...data, bets: parseInt(e.target.value, 10)})} style={{width: 150}} />
                </Form.Item>
            </Space.Compact>
        </>
    );
};
export const FreeBets: ICampaignType = {
    name: "Free Bets",
    configForm: FreeBetsConfig,
    details: FreeBetsDetails,
    playerColumns: [
        {title: "Used", render: ({playerState}: any) => playerState.used?.toString()},
        {title: "Left", render: ({playerState, config}: any) => (config.bets - playerState.used).toString()},
    ],
};

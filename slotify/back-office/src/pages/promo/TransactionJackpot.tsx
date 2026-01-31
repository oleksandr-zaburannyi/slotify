import React, {useEffect, useState} from "react";
import {ConfigProps, EventProps, ICampaignType} from "./campaignTypes";
import {Button, Form, Input, InputNumber, message, Select, Space} from "antd";
import {DeleteOutlined, PlusCircleOutlined} from "@ant-design/icons";
import env from "../../lib/env";
import {tableFilter} from "../../components/DataTable";
import SelectAutoComplete from "../../components/SelectAutoComplete";

type IPoolConfig = {contributionRate: number; seedContributionRate: number; reset: number; probability: number};
type IConfig = {poolsConfig: {[poolName: string]: IPoolConfig}; baseCurrency: string};

export const TransactionJackpotConfig: React.FC<ConfigProps<IConfig>> = ({value, onChange, edit}) => {
    const [data, setData] = useState<IConfig>(value || {poolsConfig: {}, baseCurrency: env.VITE_BASE_CURRENCY});
    useEffect(() => {
        if (data && onChange) {
            onChange(data);
        }
    }, [data]);

    const patchName = (index: number, name: string) => {
        if (data.poolsConfig[name]) {
            message.warning("Pool name needs to be unique").then();
            return;
        }
        setData(prev => {
            const entries = Object.entries(prev.poolsConfig);
            entries[index][0] = name;
            return {poolsConfig: Object.fromEntries(entries), baseCurrency: data.baseCurrency};
        });
    };

    const patchEntry = (index: number, poolConfig: Partial<IPoolConfig>) => {
        setData(prev => {
            const entries = Object.entries(prev.poolsConfig);
            entries[index][1] = {...entries[index][1], ...poolConfig};
            return {poolsConfig: Object.fromEntries(entries), baseCurrency: data.baseCurrency};
        });
    };

    const removeEntry = (index: number) => {
        setData(prev => {
            const entries = Object.entries(prev.poolsConfig);
            entries.splice(index, 1);
            return {poolsConfig: Object.fromEntries(entries), baseCurrency: data.baseCurrency};
        });
    };

    const addEntry = () => {
        setData(prev => {
            const entries = Object.entries(prev.poolsConfig);
            const newPools = {...data.poolsConfig};
            let index = entries.length;
            while (Object.keys(newPools).includes("pool" + index)) {
                index++;
            }
            newPools["pool_" + index] = {
                contributionRate: 0.02,
                seedContributionRate: 0.01,
                reset: 0,
                probability: 0.0001,
            };
            return {poolsConfig: newPools, baseCurrency: data.baseCurrency};
        });
    };

    return (
        <>
            {Object.entries(data.poolsConfig).map(([poolName, {contributionRate, seedContributionRate, reset, probability}], index) => (
                <Space.Compact key={index}>
                    <Form.Item label={"Pool name"}>
                        <Input type="text" key={index + "_name"} value={poolName} disabled={edit} onChange={e => patchName(index, e.target.value)} style={{width: 130, marginRight: 20}} />
                    </Form.Item>
                    <Form.Item label={"Contribution"}>
                        <Input
                            type="number"
                            key={index + "_contributionRate"}
                            value={contributionRate}
                            step={0.01}
                            disabled={edit}
                            onChange={e => patchEntry(index, {contributionRate: parseFloat(e.target.value)})}
                            style={{width: 110, marginRight: 20}}
                        />
                    </Form.Item>
                    <Form.Item label={"Seed Contribution"}>
                        <Input
                            type="number"
                            key={index + "_seedContributionRate"}
                            value={seedContributionRate}
                            step={0.01}
                            disabled={edit}
                            onChange={e => patchEntry(index, {seedContributionRate: parseFloat(e.target.value)})}
                            style={{width: 110, marginRight: 20}}
                        />
                    </Form.Item>
                    <Form.Item label={"Reset"}>
                        <Input type="number" key={index + "_reset"} value={reset} step={1} disabled={edit} onChange={e => patchEntry(index, {reset: parseFloat(e.target.value)})} style={{width: 100, marginRight: 20}} />
                    </Form.Item>
                    <Form.Item label={"Probability"}>
                        <Input
                            type="number"
                            key={index + "_probability"}
                            value={probability}
                            step={0.0001}
                            disabled={edit}
                            onChange={e => patchEntry(index, {probability: parseFloat(e.target.value)})}
                            style={{width: 120, marginRight: 20}}
                        />
                    </Form.Item>
                    <Form.Item style={{width: 50, marginTop: 30}}>
                        <Button type="dashed" key={index + "_button"} icon={<DeleteOutlined />} disabled={edit} onClick={() => removeEntry(index)} />
                    </Form.Item>
                </Space.Compact>
            ))}
            <Button type="dashed" style={{width: "50%", marginLeft: "25%"}} icon={<PlusCircleOutlined />} disabled={edit} onClick={() => addEntry()}>
                Add tier
            </Button>
            <Form.Item initialValue={value?.baseCurrency} label="Base currency" name="baseCurrency" style={{width: 160, marginRight: 100}} rules={[{required: true, message: "Please select currency"}]}>
                <SelectAutoComplete type={"currencies"} mode={"single-select"} disabled={edit} onChange={baseCurrency => setData({...data, baseCurrency})} />
            </Form.Item>
        </>
    );
};

const TransactionJackpotModificationEvent: React.FC<EventProps<{tier: string; value: number}, IConfig>> = ({onChange, config}) => {
    const [data, setData] = useState({tier: "my tier", value: 0});
    useEffect(() => {
        if (data && onChange) {
            onChange(data);
        }
    }, [data]);
    return (
        <Space.Compact>
            <Form.Item label="Pool Name" name="poolName" rules={[{required: true, message: "Please input"}]} style={{width: 220}}>
                <Select onChange={tier => setData({...data, tier})} style={{width: 150}}>
                    {Object.entries(config.poolsConfig).map(([poolName]) => {
                        return <Select.Option key={poolName}>{poolName}</Select.Option>;
                    })}
                </Select>
            </Form.Item>
            <Form.Item label={`Modify pool by value (${config.baseCurrency})`} name="value" rules={[{required: true, message: "Please input"}]} style={{width: 220}}>
                <InputNumber type="number" onChange={value => setData({...data, value: value as number})} style={{width: 150}} />
            </Form.Item>
        </Space.Compact>
    );
};

export const TransactionJackpot: ICampaignType = {
    name: "Transaction Jackpot",
    configForm: TransactionJackpotConfig,
    events: [{eventName: "modifyPool", name: "Modify pool", content: TransactionJackpotModificationEvent}],
    logColumns: [
        {title: "Entry Id", dataIndex: "data", jsonField: "entry", render: (entry: any) => entry?.id},
        {title: "Amount", dataIndex: "data", jsonField: "jackpotWin", render: (value: number) => value},
        {
            title: "Base Amount",
            dataIndex: "data",
            jsonField: "baseCurrencyJackpotWin",
            render: (value: number) => value,
        },
        {title: "Rate", dataIndex: "data", jsonField: "currencyRate", render: (value: number) => value},
        {title: "Player Id", dataIndex: "data", jsonField: "playerId", ...tableFilter("EQUAL")},
        {title: "Round Id", dataIndex: "data", jsonField: "roundId", ...tableFilter("EQUAL")},
        {title: "Transaction Id", dataIndex: "data", jsonField: "transactionId", ...tableFilter("EQUAL")},
    ],
};

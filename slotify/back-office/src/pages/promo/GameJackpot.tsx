import React, {useEffect, useState} from "react";
import {ConfigProps, ICampaignType} from "./campaignTypes";
import {Button, Form, Input, message, Space} from "antd";
import {DeleteOutlined, PlusCircleOutlined} from "@ant-design/icons";
import env from "../../lib/env";

type IPoolConfig = {reset: number};
type IConfig = {poolsConfig: {[poolName: string]: IPoolConfig}; baseCurrency: string};

export const GameJackpotConfig: React.FC<ConfigProps<IConfig>> = ({value, onChange, edit}) => {
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

    const patchReset = (index: number, reset: number) => {
        setData(prev => {
            const entries = Object.entries(prev.poolsConfig);
            entries[index][1] = {reset};
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
            newPools["pool_" + index] = {reset: 0};
            return {poolsConfig: newPools, baseCurrency: data.baseCurrency};
        });
    };

    return (
        <>
            {Object.entries(data.poolsConfig).map(([poolName, {reset}], index) => (
                <Space.Compact key={index}>
                    <Form.Item label={"Pool name"}>
                        <Input type="text" key={index + "_name"} value={poolName} disabled={edit} onChange={e => patchName(index, e.target.value)} style={{width: 200, marginRight: 20}} />
                    </Form.Item>
                    <Form.Item label={"Reset"}>
                        <Input type="number" key={index + "_reset"} value={reset} step={1} disabled={edit} onChange={e => patchReset(index, parseFloat(e.target.value))} style={{width: 200, marginRight: 20}} />
                    </Form.Item>
                    <Form.Item style={{width: 50, marginTop: 30}}>
                        <Button type="dashed" key={index + "_button"} icon={<DeleteOutlined />} disabled={edit} onClick={() => removeEntry(index)} />
                    </Form.Item>
                </Space.Compact>
            ))}
            <Button type="dashed" style={{width: "50%", marginLeft: "25%"}} icon={<PlusCircleOutlined />} disabled={edit} onClick={() => addEntry()}>
                Add tier
            </Button>
        </>
    );
};

export const GameJackpot: ICampaignType = {
    name: "Game Jackpot",
    configForm: GameJackpotConfig,
};

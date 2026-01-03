import React, {useEffect, useState} from "react";
import {ConfigProps, ICampaignType} from "./campaignTypes";
import {Button, Form, Input, message, Space} from "antd";
import {DeleteOutlined, PlusCircleOutlined} from "@ant-design/icons";

type IConfig = {[poolName: string]: {reset: number}};

export const GameJackpotConfig: React.FC<ConfigProps<IConfig>> = ({value, onChange, edit}) => {
    const [data, setData] = useState<IConfig>(value || {});
    useEffect(() => {
        if (data && onChange) {
            onChange(data);
        }
    }, [data]);

    const patchName = (index: number, name: string) => {
        if (data[name]) {
            message.warning("Pool name needs to be unique").then();
            return;
        }
        setData(prev => {
            const entries = Object.entries(prev);
            entries[index][0] = name;
            return Object.fromEntries(entries);
        });
    };

    const patchReset = (index: number, reset: number) => {
        setData(prev => {
            const entries = Object.entries(prev);
            entries[index][1] = {reset};
            return Object.fromEntries(entries);
        });
    };

    const removeEntry = (index: number) => {
        setData(prev => {
            const entries = Object.entries(prev);
            entries.splice(index, 1);
            return Object.fromEntries(entries);
        });
    };

    const addEntry = () => {
        setData(prev => {
            const entries = Object.entries(prev);
            const newData = {...data};
            let index = entries.length;
            while (Object.keys(newData).includes("pool" + index)) {
                index++;
            }
            newData["pool_" + index] = {reset: 0};
            return newData;
        });
    };

    return (
        <>
            {Object.entries(data).map(([poolName, {reset}], index) => (
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

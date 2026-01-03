import {Form, Input, Select, Table, Tabs} from "antd";
import React, {useEffect, useState} from "react";
import {ConfigProps, ICampaignType} from "./campaignTypes";
import env from "../../lib/env";
import Currency from "../../components/Currency";

type IConfig = {positions: number};
type IState = {index: number; data: {leaderboards: Record<string, ILeaderboardTypes>}; nextAccumulationTime: number};
type IPosition = {timestamp: number; playerId: string; win: number; bet: number; currencyRate: number; winRatio: number; roundId: string; nickname?: string; currency: string};
type ILeaderboardPeriods = {all: IPosition[]; yearly: IPosition[]; monthly: IPosition[]; daily: IPosition[]};
type ILeaderboardTypes = {winAmount: ILeaderboardPeriods; winRatio: ILeaderboardPeriods};

const periodEvaluators: Record<keyof ILeaderboardPeriods, (time: Date) => boolean> = {
    "all": () => true,
    "yearly": (date: Date) => new Date().getFullYear() === date.getFullYear(),
    "monthly": (date: Date) => new Date().getFullYear() === date.getFullYear() && new Date().getMonth() === date.getMonth(),
    "daily": (date: Date) => new Date().getFullYear() === date.getFullYear() && new Date().getMonth() === date.getMonth() && new Date().getDate() === date.getDate(),
};

export const LeaderboardDetails = ({state}: {state: IState}) => {
    if (!state || !Object.keys(state.data.leaderboards).length) return <></>;
    const leaderboards = state.data.leaderboards;
    const games = Object.keys(leaderboards);
    const types = Object.keys(leaderboards[games[0]]) as (keyof ILeaderboardTypes)[];
    const periods = Object.keys(leaderboards[games[0]][types[0]]) as (keyof ILeaderboardPeriods)[];
    const [game, setGame] = useState<string>(games[0]);
    const [type, setType] = useState<keyof ILeaderboardTypes>(types[0]);
    return (
        <>
            <div style={{width: 50, marginBottom: 10, display: "inline-block"}}>Game:</div>
            <Select value={game} onSelect={value => setGame(value)}>
                {games.map((game: string) => (
                    <Select.Option key={game}>{game}</Select.Option>
                ))}
            </Select>
            <br />
            <div style={{width: 50, marginBottom: 10, display: "inline-block"}}>Type:</div>
            <Select value={type} onSelect={value => setType(value)}>
                {types.map((type: string) => (
                    <Select.Option key={type}>{type}</Select.Option>
                ))}
            </Select>
            <Tabs
                defaultActiveKey="1"
                items={periods.map(period => ({
                    key: period,
                    label: period,
                    children: (
                        <Table
                            dataSource={leaderboards[game][type][period].filter(({timestamp}) => periodEvaluators[period](new Date(timestamp)))}
                            size={"small"}
                            scroll={{x: true}}
                            rowKey={row => row.timestamp}
                            pagination={false}
                            columns={[
                                {title: "Position", key: "position", render: (value: any, _, index) => index + 1, width: 15},
                                {title: "Time", dataIndex: "timestamp", render: timestamp => new Date(timestamp).toLocaleString()},
                                {title: "Player Id", dataIndex: "playerId"},
                                {title: "Round Id", dataIndex: "roundId"},
                                {title: "Nickname", dataIndex: "nickname"},
                                {title: "Bet", render: ({bet, currency}: any) => <Currency currency={currency} amount={bet} onlyAmount={false} />},
                                {title: "Win", render: ({win, currency}: any) => <Currency currency={currency} amount={win} onlyAmount={false} />},
                                {title: "Win ratio", dataIndex: "winRatio", render: value => "x" + value},
                                {title: `Win in ${env.VITE_BASE_CURRENCY.toLowerCase()}`, render: ({win, currencyRate}: any) => <Currency currency={env.VITE_BASE_CURRENCY} amount={win / currencyRate} />},
                            ]}
                        />
                    ),
                }))}
            />
        </>
    );
};

export const LeaderboardConfig: React.FC<ConfigProps<IConfig>> = ({value, onChange, edit}) => {
    const [data, setData] = useState(value || {positions: 10});
    useEffect(() => {
        onChange!(data);
    }, [data]);

    return (
        <>
            <Input.Group compact>
                <Form.Item initialValue={value?.positions} label={`Positions`} name="positions" rules={[{required: true, message: "Please input"}]} style={{width: "50%"}}>
                    <Input type="number" step={1} disabled={edit} onChange={e => setData({...data, positions: parseFloat(e.target.value)})} style={{width: 150}} />
                </Form.Item>
            </Input.Group>
        </>
    );
};

export const Leaderboard: ICampaignType = {
    name: "Leaderboard",
    configForm: LeaderboardConfig,
    details: LeaderboardDetails,
};

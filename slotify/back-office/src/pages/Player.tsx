import {Card, InputNumber, Table, Tag, Tooltip as AntTooltip} from "antd";
import {gql} from "graphql-request";
import React, {useEffect, useMemo, useState} from "react";
import useSWR from "swr";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {useParams} from "react-router-dom";
import {useAppState} from "../lib/AppProvider";
import Currency from "../components/Currency";
import env from "../lib/env";
import {Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis} from "recharts";
import dayjs from "dayjs";

const DEFAULT_STATS_DAYS = 10;
const MAX_STATS_DAYS = 100;

const PlayerGameWinChart = ({data}: {data: any[]}) => {
    const waterfallData = useMemo(() => {
        let cumulative = 0;
        return data.map(item => {
            const base = cumulative;
            cumulative += item.gameWin;
            return {
                ...item,
                base: item.gameWin >= 0 ? base : cumulative,
                value: Math.abs(item.gameWin),
                cumulative,
            };
        });
    }, [data]);

    const chartWidth = Math.max(waterfallData.length * 27 + 50, 400);

    return (
        <div style={{overflowX: "auto", width: "100%"}}>
            <BarChart data={waterfallData} width={chartWidth} height={300} margin={{top: 5, right: 20, left: 10, bottom: 5}} barGap={0} barCategoryGap={2}>
                <XAxis dataKey="hour" tickFormatter={tick => dayjs(tick).format("MM/DD HH:mm")} angle={-45} textAnchor="end" height={80} fontSize={10} />
                <YAxis tickFormatter={tick => `€${Math.round(tick / 100) / 10}k`} />
                <Tooltip
                    formatter={(value: any, name: string) => {
                        if (name === "value") return null;
                        if (name === "base") return null;
                        return [value, name];
                    }}
                    content={({active, payload, label}) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0]?.payload;
                        return (
                            <div style={{background: "white", border: "1px solid #ccc", padding: "8px", fontSize: "12px"}}>
                                <div>{dayjs(label).format("YYYY-MM-DD HH:mm")}</div>
                                <div style={{color: item.gameWin >= 0 ? "#52c41a" : "#ff4d4f"}}>
                                    Game Win: <Currency currency={env.VITE_BASE_CURRENCY} amount={item.gameWin} onlyAmount={false} />
                                </div>
                                <div>
                                    Cumulative: <Currency currency={env.VITE_BASE_CURRENCY} amount={item.cumulative} onlyAmount={false} />
                                </div>
                            </div>
                        );
                    }}
                />
                <CartesianGrid stroke="#f5f5f5" />
                <Bar dataKey="base" stackId="stack" fill="transparent" isAnimationActive={false} barSize={25} />
                <Bar dataKey="value" stackId="stack" isAnimationActive={false} barSize={25}>
                    {waterfallData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.gameWin >= 0 ? "#52c41a" : "#ff4d4f"} />
                    ))}
                </Bar>
            </BarChart>
        </div>
    );
};

const Player = () => {
    const [state] = useAppState();
    const {id} = useParams<{id: string}>();
    const fetcher = useGraphQlFetcher();
    const [statsDays, setStatsDays] = useState(DEFAULT_STATS_DAYS);
    const [statsDaysInput, setStatsDaysInput] = useState<number | null>(DEFAULT_STATS_DAYS);

    const applyStatsDays = () => {
        const clampedValue = Math.min(statsDaysInput || DEFAULT_STATS_DAYS, MAX_STATS_DAYS);
        setStatsDaysInput(clampedValue);
        setStatsDays(clampedValue);
    };

    const variablesPlayer = useMemo(() => ({playerId: id}), [id]);

    const queryPlayer = gql`
        query ($playerId: JSON!) {
            players(filter: [{field: "playerId", type: EQUAL, value: $playerId}], limit: 1) {
                items {
                    playerId
                    nativeId
                    nickname
                    currency
                    wallet
                    operator
                    brand
                    gender
                    country
                    jurisdiction
                    group
                    blocked
                    createdAt
                    excludedFromInspection
                    excludedFromReports
                }
            }
        }
    `;
    const playerData = useSWR(state?.services.includes("adapter") && state?.account?.permissions?.includes("players") ? [queryPlayer, variablesPlayer] : null, fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});

    const queryGameWin = gql`
        query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
            gameWin(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
                items {
                    hour
                    gameWin
                    totalBet
                    totalWin
                    bets
                    wins
                }
            }
        }
    `;

    const gameWinVars = useMemo(
        () => ({
            filter: [
                {type: "EQUAL", field: "playerId", value: id},
                {type: "GREATER_OR_EQUAL", field: "date", value: dayjs().subtract(statsDays, "day").format("YYYY-MM-DD")},
            ],
            options: {convert: true, interval: "hour", dimensions: []},
            limit: statsDays * 24,
            sort: {field: "hour", order: "DESC"},
        }),
        [id, statsDays],
    );

    const gameWinData = useSWR(state?.services.includes("adapter") && state?.account?.permissions?.includes("gameWin") ? [queryGameWin, gameWinVars] : null, fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});

    const player = playerData.data?.players?.items?.[0] || {};

    const chartData = useMemo(() => {
        if (!gameWinData.data?.gameWin?.items) return [];
        return [...gameWinData.data.gameWin.items].reverse();
    }, [gameWinData.data]);

    const stats = useMemo(() => {
        if (!gameWinData.data?.gameWin?.items?.length) return null;
        const items = gameWinData.data.gameWin.items;
        const totalBet = items.reduce((sum: number, item: any) => sum + (item.totalBet || 0), 0);
        const totalWin = items.reduce((sum: number, item: any) => sum + (item.totalWin || 0), 0);
        const gameWin = items.reduce((sum: number, item: any) => sum + (item.gameWin || 0), 0);
        const bets = items.reduce((sum: number, item: any) => sum + (item.bets || 0), 0);
        const wins = items.reduce((sum: number, item: any) => sum + (item.wins || 0), 0);
        const rtp = totalBet > 0 ? totalWin / totalBet : 0;
        return {totalBet, totalWin, gameWin, bets, wins, rtp};
    }, [gameWinData.data]);

    const summaryColumns = [
        {dataIndex: "label", key: "label", render: (value: string) => <b>{value}</b>, width: 135},
        {dataIndex: "value", key: "value"},
    ];

    const summaryData = [
        {label: "Player Id", value: player?.playerId},
        {label: "Native Id", value: player?.nativeId},
        {label: "Created at", value: player?.createdAt ? new Date(player.createdAt).toLocaleString() : ""},
        {label: "Nickname", value: player?.nickname},
        {label: "Currency", value: player?.currency},
        {label: "Wallet", value: player?.wallet},
        {label: "Operator", value: player?.operator},
        {label: "Brand", value: player?.brand},
        {label: "Gender", value: player?.gender},
        {label: "Country", value: player?.country},
        {label: "Jurisdiction", value: player?.jurisdiction},
        {label: "Group", value: player?.group},
        {
            label: "Blocked",
            value: player?.blocked ? <Tag color="red">BLOCKED</Tag> : null,
        },
        {
            label: "Excluded from",
            value:
                player?.excludedFromInspection || player?.excludedFromReports ? (
                    <>
                        {player?.excludedFromInspection && <Tag>Inspection</Tag>}
                        {player?.excludedFromReports && <Tag> Reports</Tag>}
                    </>
                ) : null,
        },
    ];

    const statsDataFormatted = [
        {label: "Total Bet", value: stats ? <Currency currency={env.VITE_BASE_CURRENCY} amount={stats.totalBet} onlyAmount={false} /> : "-"},
        {label: "Total Win", value: stats ? <Currency currency={env.VITE_BASE_CURRENCY} amount={stats.totalWin} onlyAmount={false} /> : "-"},
        {label: "Game Win", value: stats ? <Currency currency={env.VITE_BASE_CURRENCY} amount={stats.gameWin} onlyAmount={false} /> : "-"},
        {label: "Bets", value: stats?.bets?.toLocaleString() || "-"},
        {label: "Wins", value: stats?.wins?.toLocaleString() || "-"},
        {label: "RTP", value: stats?.rtp ? (stats.rtp * 100).toFixed(2) + "%" : "-"},
    ];

    return (
        <>
            <Card title={"Player Info"}>
                <Table dataSource={summaryData} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
            </Card>
            &nbsp;
            <Card
                title={
                    <span>
                        Player Statistics (Last{" "}
                        <AntTooltip title={`Maximum ${MAX_STATS_DAYS} days`} open={statsDaysInput !== null && statsDaysInput > MAX_STATS_DAYS}>
                            <InputNumber
                                min={1}
                                value={statsDaysInput}
                                onChange={value => setStatsDaysInput(value)}
                                onBlur={applyStatsDays}
                                status={statsDaysInput !== null && statsDaysInput > MAX_STATS_DAYS ? "error" : undefined}
                                size="small"
                                style={{width: 60}}
                            />
                        </AntTooltip>{" "}
                        Days)
                    </span>
                }
            >
                <Table dataSource={statsDataFormatted} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
                <div style={{marginTop: 16}}>
                    <PlayerGameWinChart data={chartData} />
                    <div style={{textAlign: "center", color: "#666", fontSize: 12, marginTop: 8}}>Game Win Per Hour</div>
                </div>
            </Card>
        </>
    );
};

export default Player;

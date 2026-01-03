import {Button, Divider, Form, Input, Select, Space, Table, Tooltip} from "antd";
import React, {useEffect, useState} from "react";
import {ConfigProps, ICampaignType} from "./campaignTypes";
import {ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, InfoCircleOutlined, PlusCircleOutlined} from "@ant-design/icons";
import env from "../../lib/env";
import Currency from "../../components/Currency";
import {Link} from "react-router-dom";

type IPrizeConfig = {type: "cash" | "item"; value: number | string; amount: number};
type ICampaignConfig = {
    qualifyingBet: number;
    baseBetOnly: boolean;
    prizes: IPrizeConfig[];
};
type ILeaderboard = {
    winRatios: (number | null)[];
    roundIds: (string | null)[];
    games: (string | null)[];
    nicknames: (string | null)[];
};
type ICampaignState = {
    _campaignCurrencyRates: Record<string, number>;
    _exchangedCashValues: Record<string, number[]>;
    leaderboard: ILeaderboard;
    _leaderboardPlayerIds: (string | null)[];
};

type ITournamentDetails = {config: ICampaignConfig; state: ICampaignState};

export const TournamentDetails = ({config, state}: ITournamentDetails) => {
    const setupColumns = [
        {dataIndex: "label", key: "label", render: (value: string) => <b>{value}</b>, width: 200},
        {dataIndex: "value", key: "value"},
    ];
    const setupData = [
        {label: "Min Bet", value: <Currency currency={env.VITE_BASE_CURRENCY} amount={config.qualifyingBet} onlyAmount={false} />},
        {label: "Bet Type", value: config.baseBetOnly ? "Base Bet Only" : "All Bet Types"},
    ];

    const leaderboardColumns = [
        {title: "Position", dataIndex: "position"},
        {title: "Prize", dataIndex: "prize", render: (prize: IPrizeConfig) => (prize.type === "cash" ? <Currency currency={env.VITE_BASE_CURRENCY} amount={prize.value as number} onlyAmount={false} /> : prize.value)},
        {title: "Round Id", dataIndex: "roundId", render: (roundId: string) => <Link to={`/rounds/${roundId}`}>{roundId}</Link>},
        {title: "Player Id", dataIndex: "playerId"},
        {title: "Win Ratio", dataIndex: "winRatio", render: (value: number) => value && `x${value}`},
    ];

    const prizeValuesAtPositions = config.prizes.flatMap((prize: any) => Array(prize.amount).fill(prize));
    const leaderboard = state.leaderboard.winRatios.map((winRatio, i) => {
        return {position: i + 1, winRatio, nickname: state.leaderboard.nicknames[i], prize: prizeValuesAtPositions[i], roundId: state.leaderboard.roundIds[i], playerId: state._leaderboardPlayerIds[i]};
    });

    return (
        <>
            <Divider>Setup</Divider>
            <Table dataSource={setupData} size={"small"} rowKey={"label"} columns={setupColumns} showHeader={false} pagination={false} />

            <Divider>Leaderboard</Divider>
            <Table rowKey={"position"} dataSource={leaderboard} size={"small"} columns={leaderboardColumns} pagination={false} />
        </>
    );
};

export const TournamentConfig: React.FC<ConfigProps> = ({value, onChange, edit}) => {
    const [data, setData] = useState<ICampaignConfig>(edit ? value : {qualifyingBet: 1.0, baseBetOnly: true, prizes: []});
    useEffect(() => {
        onChange!(data);
    }, [data]);

    const patchPrizes = (index: number, newPrize: any) => {
        setData({
            ...data,
            prizes: data.prizes.map((prize, i) => (i === index ? {...prize, ...newPrize} : prize)),
        });
    };

    const swapPrizes = (i: number, j: number) => {
        const newPrizes = [...data.prizes];
        newPrizes[j] = data.prizes[i];
        newPrizes[i] = data.prizes[j];
        setData({
            ...data,
            prizes: newPrizes,
        });
    };

    const changePrizeType = (index: number, newPrize: any) => {
        setData({...data, prizes: []});
        setTimeout(
            () =>
                setData({
                    ...data,
                    prizes: data.prizes.map((prize, i) => (i === index ? {...prize, ...newPrize} : prize)),
                }),
            0,
        );
    };

    const startPlaces = [0];
    for (let prizeIndex = 1; prizeIndex < data.prizes.length; prizeIndex++) {
        startPlaces.push(startPlaces[prizeIndex - 1] + data.prizes[prizeIndex - 1].amount);
    }

    return (
        <>
            <Space.Compact>
                <Form.Item
                    initialValue={data.qualifyingBet.toFixed(2)}
                    name="qualifyingBet"
                    rules={[{required: true}]}
                    label={
                        <>
                            Min Bet ({env.VITE_BASE_CURRENCY}) &nbsp;{" "}
                            <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={`This threshold will be converted to player's currency`}>
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                >
                    <Input type="number" step={0.01} min={0} disabled={edit} onChange={e => setData({...data, qualifyingBet: parseFloat(e.target.value)})} style={{width: 120, marginRight: 20}} />
                </Form.Item>

                <Form.Item
                    initialValue={data.baseBetOnly}
                    name={"baseBetOnly"}
                    rules={[{required: true}]}
                    style={{width: "160px"}}
                    label={
                        <>
                            Bet Type ({env.VITE_BASE_CURRENCY}) &nbsp;
                            <Tooltip
                                placement={"left"}
                                overlayStyle={{maxWidth: "500px"}}
                                title={`Selecting Base Bet Only results in only base game ("main") bet qualify for the tournament. 
                                    Otherwise other types of bets (such as Golden Bet, Buy Bonus) will also qualify.`}
                            >
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                >
                    <Select style={{width: "140px"}} disabled={edit} onChange={value => setData({...data, baseBetOnly: value})}>
                        <Select.Option value={true} key={"baseBetOnly"}>
                            Base Bet Only
                        </Select.Option>
                        <Select.Option value={false} key={"allBetTypes"}>
                            All Bet Types
                        </Select.Option>
                    </Select>
                </Form.Item>
            </Space.Compact>

            <Divider>Prizes</Divider>

            {data.prizes.map((prize, index) => (
                <Space.Compact key={index}>
                    <Form.Item initialValue={prize.type} name={index + "_type"} label={prize.amount > 1 ? "Places" : "Place"} style={{width: "90px", marginRight: 20}}>
                        {prize.amount > 1 ? startPlaces[index] + 1 + "..." + (startPlaces[index] + prize.amount) : startPlaces[index] + 1}
                    </Form.Item>

                    <Form.Item initialValue={prize.type} name={index + "_type"} rules={[{required: true}]} label={`Type`} style={{width: "100px"}}>
                        <Select style={{width: "80px"}} disabled={edit} onChange={type => changePrizeType(index, {type, value: type === "cash" ? 1.0 : "my item prize"})}>
                            <Select.Option value={"cash"} key={"cash"}>
                                Cash
                            </Select.Option>
                            <Select.Option value={"item"} key={"item"}>
                                Item
                            </Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item initialValue={prize.amount} name={index + "_amount"} label={"Quantity"} rules={[{required: true}]}>
                        <Input type="number" step={1} min={1} disabled={edit} onChange={e => patchPrizes(index, {amount: parseInt(e.target.value)})} style={{width: 120, marginRight: 20}} />
                    </Form.Item>

                    {prize.type === "cash" ? (
                        <Form.Item
                            initialValue={(prize.value as number).toFixed(2)}
                            name={index + "_value"}
                            rules={[{required: true}]}
                            label={
                                <>
                                    Cash ({env.VITE_BASE_CURRENCY}) &nbsp;{" "}
                                    <Tooltip
                                        placement={"left"}
                                        overlayStyle={{maxWidth: "500px"}}
                                        title={`This value will get converted to player's currency - system will try to round the value to a nice looking cash prize. This might affect the cost of Campaign up to 10% of the base currency (${env.VITE_BASE_CURRENCY}) cost.`}
                                    >
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                </>
                            }
                        >
                            <Input type="number" step={0.01} min={0} disabled={edit} onChange={e => patchPrizes(index, {value: parseFloat(e.target.value)})} style={{width: 120, marginRight: 20}} />
                        </Form.Item>
                    ) : (
                        <Form.Item initialValue={prize.value} name={index + "_value"} label={`Item name`}>
                            <Input type="text" disabled={edit} onChange={e => patchPrizes(index, {value: e.target.value})} style={{width: 120, marginRight: 20}} />
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Button
                            disabled={edit || index === 0}
                            type="dashed"
                            style={{width: 50, marginTop: 30, marginRight: 10}}
                            icon={<ArrowUpOutlined />}
                            onClick={() => {
                                setData({...data, prizes: []});
                                setTimeout(() => {
                                    swapPrizes(index, index - 1);
                                }, 0);
                            }}
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            disabled={edit || index === data.prizes.length - 1}
                            type="dashed"
                            style={{width: 50, marginTop: 30, marginRight: 20}}
                            icon={<ArrowDownOutlined />}
                            onClick={() => {
                                setData({...data, prizes: []});
                                setTimeout(() => {
                                    swapPrizes(index, index + 1);
                                }, 0);
                            }}
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            disabled={edit}
                            type="dashed"
                            style={{width: 50, marginTop: 30}}
                            icon={<DeleteOutlined />}
                            onClick={() => {
                                setData({...data, prizes: []});
                                setTimeout(() => {
                                    setData({...data, prizes: data.prizes.filter((_, i) => i !== index)});
                                }, 0);
                            }}
                        />
                    </Form.Item>
                </Space.Compact>
            ))}

            <Button
                disabled={edit}
                type="dashed"
                style={{width: "50%", marginLeft: "25%"}}
                icon={<PlusCircleOutlined />}
                onClick={() => {
                    setData({...data, prizes: data.prizes.concat({type: "cash", value: 1.0, amount: 10})});
                }}
            >
                Add prize
            </Button>
        </>
    );
};

export const Tournament: ICampaignType = {
    name: "Tournament",
    configForm: TournamentConfig,
    details: TournamentDetails,
};

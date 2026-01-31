import {Button, DatePicker, Divider, Form, Input, Select, Space, Table, Tooltip} from "antd";
import React, {useEffect, useState} from "react";
import {ConfigProps, ICampaignType} from "./campaignTypes";
import {DeleteOutlined, InfoCircleOutlined, PlusCircleOutlined} from "@ant-design/icons";
import env from "../../lib/env";
import dayjs from "dayjs";
import Currency from "../../components/Currency";

type IPrizeConfig = {type: "cash" | "item" | "multiplier"; value: number | string; amount: number; limit?: number};
type ICampaignConfig = {qualifyingBet: number; probability: number; boostedProbabilityStart?: number; prizes: IPrizeConfig[]};
type ICampaignState = {amountsLeft: number[]; _fixedCurrencyRates: Record<string, number>};

type IPrizeDropDetails = {config: ICampaignConfig; state: ICampaignState};

export const parseCashValue = (value: string) => Number(parseFloat(value).toFixed(2));

export const PrizeDropDetails = ({config, state}: IPrizeDropDetails) => {
    const setupColumns = [
        {dataIndex: "label", key: "label", render: (value: string) => <b>{value}</b>, width: 200},
        {dataIndex: "value", key: "value"},
    ];
    const setupData: any[] = [
        {label: "Min bet", value: <Currency currency={env.VITE_BASE_CURRENCY} amount={config.qualifyingBet} />},
        {label: "Probability", value: config.probability},
    ];
    if (config.boostedProbabilityStart) {
        setupData.push({label: "Probability Boost start", value: dayjs(config.boostedProbabilityStart!).toString()});
    }

    const prizesColumns = [
        {
            title: "Prize",
            render: ({value, type, limit}: any) => (
                <>
                    {type === "cash" && <Currency currency={env.VITE_BASE_CURRENCY} amount={value} />}
                    {type === "item" && value}
                    {type === "multiplier" && `x${value} bet` + (Number.isFinite(limit) ? `(limit ${limit})` : "")}
                </>
            ),
        },
        {title: "Amount Left", dataIndex: "amountLeft"},
    ];
    const prizesData = config.prizes.map((prize, index) => ({type: prize.type, value: prize.value, key: index, amountLeft: state.amountsLeft[index] + "/" + prize.amount}));

    return (
        <>
            <Divider>Setup</Divider>
            <Table dataSource={setupData} size={"small"} rowKey={"label"} columns={setupColumns} showHeader={false} pagination={false} />
            <Divider>Prizes</Divider>
            <Table dataSource={prizesData} size={"small"} columns={prizesColumns} pagination={false} />
        </>
    );
};

export const PrizeDropConfig: React.FC<ConfigProps> = ({value, onChange, edit}) => {
    const [data, setData] = useState<ICampaignConfig>(edit ? value : {qualifyingBet: 1.0, probability: 0.001, prizes: []});
    useEffect(() => {
        onChange!(data);
    }, [data]);

    const patchPrizes = (index: number, newPrize: any) => {
        setData({
            ...data,
            prizes: data.prizes.map((prize, i) => (i === index ? {...prize, ...newPrize} : prize)),
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

    const renderPrize = (index: number, prize: any) => {
        switch (prize.type) {
            case "cash":
                return (
                    <Form.Item
                        initialValue={(prize.value as number).toFixed(2)}
                        name={index + "_value"}
                        rules={[{required: true, message: "Please enter value"}]}
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
                        <Input type="number" step={0.01} min={0} disabled={edit} onChange={e => patchPrizes(index, {value: parseCashValue(e.target.value)})} style={{width: 120, marginRight: 20}} />
                    </Form.Item>
                );
            case "multiplier":
                return (
                    <>
                        <Form.Item
                            initialValue={prize.value}
                            name={index + "_value"}
                            rules={[{required: true, message: "Please enter value"}]}
                            label={
                                <>
                                    Multiplier &nbsp;{" "}
                                    <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={`Bet amount will be multiplied by this value and awarded as prize.`}>
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                </>
                            }
                        >
                            <Input type="number" step={1} min={1} disabled={edit} onChange={e => patchPrizes(index, {value: parseFloat(e.target.value)})} style={{width: 120, marginRight: 20}} />
                        </Form.Item>

                        <Form.Item
                            initialValue={prize.limit?.toFixed(2)}
                            name={index + "_limit"}
                            rules={[{required: false, message: "Please enter value"}]}
                            label={
                                <>
                                    Cash limit ({env.VITE_BASE_CURRENCY}) &nbsp;{" "}
                                    <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={`Bet Multiplier cash prize will be capped at this value.`}>
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                </>
                            }
                        >
                            <Input type="number" step={0.01} min={0} disabled={edit} onChange={e => patchPrizes(index, {limit: parseCashValue(e.target.value)})} style={{width: 120, marginRight: 20}} />
                        </Form.Item>
                    </>
                );
            case "item":
                return (
                    <Form.Item initialValue={prize.value} name={index + "_value"} label={`Item name`} rules={[{required: true, message: "Please enter value"}]}>
                        <Input type="text" disabled={edit} onChange={e => patchPrizes(index, {value: e.target.value})} style={{width: 120, marginRight: 20}} />
                    </Form.Item>
                );
        }
    };

    return (
        <>
            <Space.Compact>
                <Form.Item
                    initialValue={data.qualifyingBet.toFixed(2)}
                    name="qualifyingBet"
                    rules={[{required: true}]}
                    label={
                        <>
                            Min bet ({env.VITE_BASE_CURRENCY}) &nbsp;{" "}
                            <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={`This threshold will be converted to player's currency`}>
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                >
                    <Input type="number" step={0.01} min={0} disabled={edit} onChange={e => setData({...data, qualifyingBet: parseFloat(e.target.value)})} style={{width: 120, marginRight: 20}} />
                </Form.Item>

                <Form.Item initialValue={data.probability} label="Drop probability" name="probability" rules={[{required: true}]}>
                    <Input type="number" step={0.001} min={0} onChange={e => setData({...data, probability: parseFloat(e.target.value)})} style={{width: 120, marginRight: 20}} />
                </Form.Item>

                <Form.Item
                    initialValue={data.boostedProbabilityStart ? dayjs(data.boostedProbabilityStart) : undefined}
                    name="boostedProbabilityStart"
                    label={
                        <>
                            Probability Boost start &nbsp;{" "}
                            <Tooltip
                                placement={"left"}
                                overlayStyle={{maxWidth: "500px"}}
                                title={`From this date on, the probability will start growing (linearly) until it reaches 100% at the End date of the campaign (End date needs to be set as well). If this field is left unfilled, then the Win Probability will stay constant for the whole duration of the campaign.`}
                            >
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                >
                    <DatePicker showTime onChange={e => setData({...data, boostedProbabilityStart: e?.valueOf()})} />
                </Form.Item>
            </Space.Compact>

            <Divider>Prizes</Divider>

            {data.prizes.map((prize, index) => (
                <Space.Compact key={index}>
                    <Form.Item initialValue={prize.type} name={index + "_type"} rules={[{required: true}]} label={`Type`} style={{width: "200px"}}>
                        <Select
                            style={{width: "180px"}}
                            disabled={edit}
                            onChange={type =>
                                changePrizeType(index, {
                                    type,
                                    value: {cash: 1.0, item: "my item prize", multiplier: 1}[type as string],
                                })
                            }
                        >
                            ,{" "}
                            <Select.Option value={"cash"} key={"cash"}>
                                Cash
                            </Select.Option>
                            <Select.Option value={"multiplier"} key={"multiplier"}>
                                Bet Multiplier
                            </Select.Option>
                            <Select.Option value={"item"} key={"item"}>
                                Item
                            </Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item initialValue={prize.amount} name={index + "_amount"} label={`Quantity`} rules={[{required: true}]}>
                        <Input type="number" step={1} min={1} disabled={edit} onChange={e => patchPrizes(index, {amount: parseInt(e.target.value)})} style={{width: 120, marginRight: 20}} />
                    </Form.Item>

                    {renderPrize(index, prize)}

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

export const PrizeDrop: ICampaignType = {
    name: "Prize Drop",
    configForm: PrizeDropConfig,
    details: PrizeDropDetails,
};

import {Button, DatePicker, Divider, Form, Input, Select, Space, Table, Tooltip} from "antd";
import React, {useEffect, useState} from "react";
import {ConfigProps, ICampaignType} from "./campaignTypes";
import {CloseCircleOutlined, DeleteOutlined, InfoCircleOutlined, PlusCircleOutlined} from "@ant-design/icons";
import env from "../../lib/env";
import dayjs from "dayjs";
import Currency from "../../components/Currency";
import {PrizeItemTranslations} from "../../components/PrizeItemTranslations";
import {CurrencyOverridesModal} from "../../components/CurrencyOverridesModal";
import useGraphQlFetcher from "../../lib/useGraphQlFetcher";
import {gql} from "graphql-request";

type IPrizeConfig = {type: "cash" | "item" | "multiplier"; value: number | string; amount: number; limit?: number; weight?: number; translations?: Record<string, string>; currencyOverrides?: Record<string, number>};
type ICampaignConfig = {qualifyingBet: number; qualifyingBetOverrides?: Record<string, number>; probability: number; boostedProbabilityStart?: number; prizes: IPrizeConfig[]};
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
            render: ({value, type, limit, translations}: any) => (
                <>
                    {type === "cash" && <Currency currency={env.VITE_BASE_CURRENCY} amount={value} />}
                    {type === "item" && (
                        <>
                            {value}
                            {translations && Object.keys(translations).length > 0 && <span style={{color: "#888", marginLeft: 8}}>({Object.keys(translations).length} translations)</span>}
                        </>
                    )}
                    {type === "multiplier" && `x${value} bet` + (Number.isFinite(limit) ? `(limit ${limit})` : "")}
                </>
            ),
        },
        {title: "Weight", dataIndex: "weight"},
        {title: "Amount Left", dataIndex: "amountLeft"},
    ];
    const prizesData = config.prizes.map((prize, index) => ({type: prize.type, value: prize.value, translations: prize.translations, key: index, weight: prize.weight ?? 1, amountLeft: state.amountsLeft[index] + "/" + prize.amount}));

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
    const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
    const fetcher = useGraphQlFetcher();

    useEffect(() => {
        onChange!(data);
    }, [data]);

    useEffect(() => {
        fetcher([
            gql`
                query {
                    defaultThemes
                }
            `,
            {},
        ]).then(response => {
            if (response.defaultThemes?.prizeDrop?.translations) {
                setAvailableLanguages(Object.keys(response.defaultThemes.prizeDrop.translations));
            }
        });
    }, []);

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
            case "cash": {
                const hasOverrides = Object.keys(prize.currencyOverrides || {}).length > 0;
                return (
                    <>
                        <Form.Item
                            initialValue={(prize.value as number).toFixed(2)}
                            name={index + "_value"}
                            rules={[{required: true, message: "Please enter value"}]}
                            label={
                                <>
                                    Cash ({env.VITE_BASE_CURRENCY}) &nbsp;{" "}
                                    <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={`This value will get converted to player's currency. Use the currency button to define custom values per currency.`}>
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                </>
                            }
                        >
                            <Input
                                type="number"
                                step={0.01}
                                min={0}
                                disabled={edit || hasOverrides}
                                onChange={e => patchPrizes(index, {value: parseCashValue(e.target.value)})}
                                style={{width: 120}}
                                suffix={hasOverrides && !edit ? <CloseCircleOutlined style={{color: "#ff4d4f", cursor: "pointer"}} onClick={() => patchPrizes(index, {currencyOverrides: {}})} /> : undefined}
                            />
                        </Form.Item>
                        <CurrencyOverridesModal baseValue={prize.value as number} currencyOverrides={prize.currencyOverrides || {}} onChange={currencyOverrides => patchPrizes(index, {currencyOverrides})} disabled={edit} />
                    </>
                );
            }
            case "multiplier": {
                const hasOverrides = Object.keys(prize.currencyOverrides || {}).length > 0;
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
                                    <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={`Bet Multiplier cash prize will be capped at this value. Use the currency button to define custom values per currency.`}>
                                        <InfoCircleOutlined />
                                    </Tooltip>
                                </>
                            }
                        >
                            <Input
                                type="number"
                                step={0.01}
                                min={0}
                                disabled={edit || hasOverrides}
                                onChange={e => patchPrizes(index, {limit: parseCashValue(e.target.value)})}
                                style={{width: 120, marginRight: 20}}
                                suffix={hasOverrides && !edit ? <CloseCircleOutlined style={{color: "#ff4d4f", cursor: "pointer"}} onClick={() => patchPrizes(index, {currencyOverrides: {}})} /> : undefined}
                            />
                        </Form.Item>
                        <CurrencyOverridesModal baseValue={prize.limit || 0} currencyOverrides={prize.currencyOverrides || {}} onChange={currencyOverrides => patchPrizes(index, {currencyOverrides})} disabled={edit} />
                    </>
                );
            }
            case "item":
                return (
                    <>
                        <Form.Item initialValue={prize.value} name={index + "_value"} label={`Item name`} rules={[{required: true, message: "Please enter value"}]} style={{marginBottom: 0}}>
                            <Input type="text" disabled={edit} onChange={e => patchPrizes(index, {value: e.target.value})} style={{width: 150}} />
                        </Form.Item>
                        {availableLanguages.length > 0 && (
                            <Form.Item>
                                <PrizeItemTranslations translations={prize.translations || {}} onChange={translations => patchPrizes(index, {translations})} availableLanguages={availableLanguages} disabled={edit} />
                            </Form.Item>
                        )}
                    </>
                );
        }
    };

    const hasQualifyingBetOverrides = Object.keys(data.qualifyingBetOverrides || {}).length > 0;

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
                            <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={`This threshold will be converted to player's currency. Use the currency button to define custom values per currency.`}>
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                >
                    <Input
                        type="number"
                        step={0.01}
                        min={0}
                        disabled={edit || hasQualifyingBetOverrides}
                        onChange={e => setData({...data, qualifyingBet: parseFloat(e.target.value)})}
                        style={{width: 130}}
                        suffix={hasQualifyingBetOverrides && !edit ? <CloseCircleOutlined style={{color: "#ff4d4f", cursor: "pointer"}} onClick={() => setData({...data, qualifyingBetOverrides: {}})} /> : undefined}
                    />
                </Form.Item>
                <CurrencyOverridesModal baseValue={data.qualifyingBet} currencyOverrides={data.qualifyingBetOverrides || {}} onChange={qualifyingBetOverrides => setData({...data, qualifyingBetOverrides})} disabled={edit} />

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
                                    translations: type === "item" ? {} : undefined,
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

                    <Form.Item
                        initialValue={prize.weight ?? 1}
                        name={index + "_weight"}
                        label={
                            <>
                                Weight &nbsp;{" "}
                                <Tooltip
                                    placement={"left"}
                                    overlayStyle={{maxWidth: "500px"}}
                                    title={`Probability weight for this prize. Higher weight means higher chance of being selected. Example: a prize with weight 2 has twice the probability of a prize with weight 1.`}
                                >
                                    <InfoCircleOutlined />
                                </Tooltip>
                            </>
                        }
                        rules={[{required: true}]}
                    >
                        <Input type="number" step={1} min={1} disabled={edit} onChange={e => { const weight = parseInt(e.target.value); if (!isNaN(weight) && weight >= 1) patchPrizes(index, {weight}); }} style={{width: 80, marginRight: 20}} />
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
                    setData({...data, prizes: data.prizes.concat({type: "cash", value: 1.0, amount: 10, weight: 1})});
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
    playerColumns: [
        {title: "Qualified Bets", render: ({playerState}: any) => (playerState?.qualifiedBets ?? 0).toString()},
    ],
};

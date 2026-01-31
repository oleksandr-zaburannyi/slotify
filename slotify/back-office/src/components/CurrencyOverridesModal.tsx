import React, {useEffect, useState} from "react";
import {Button, InputNumber, Modal, Spin, Table, Tooltip} from "antd";
import {DollarOutlined} from "@ant-design/icons";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {gql} from "graphql-request";
import env from "../lib/env";

interface CurrencyOverridesModalProps {
    baseValue: number;
    currencyOverrides: Record<string, number>;
    onChange: (overrides: Record<string, number>) => void;
    disabled?: boolean;
}

type ExchangedValue = {currency: string; rate: number; exchangedValue: number};

export const CurrencyOverridesModal: React.FC<CurrencyOverridesModalProps> = ({baseValue, currencyOverrides, onChange, disabled}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [exchangedValues, setExchangedValues] = useState<ExchangedValue[]>([]);
    const [loading, setLoading] = useState(false);
    const [localOverrides, setLocalOverrides] = useState<Record<string, number>>({});
    const [decimalsPerCurrency, setDecimalsPerCurrency] = useState<Record<string, number>>({});
    const fetcher = useGraphQlFetcher();

    const getDecimals = (currency: string) => decimalsPerCurrency[currency] ?? 2;

    const overrideCount = Object.keys(currencyOverrides || {}).length;

    useEffect(() => {
        if (isModalOpen) {
            fetchExchangedValues();
        }
    }, [isModalOpen, baseValue]);

    const fetchExchangedValues = async () => {
        if (baseValue <= 0) {
            setExchangedValues([]);
            setLocalOverrides({});
            return;
        }

        setLoading(true);
        try {
            const response = await fetcher([
                gql`
                    query ($baseValue: Float!) {
                        exchangedPrizeValues(baseValue: $baseValue) {
                            currency
                            rate
                            exchangedValue
                        }
                        fixedCurrencyRates(limit: 10000) {
                            items {
                                currency
                                decimals
                            }
                        }
                    }
                `,
                {baseValue},
            ]);

            // Build a set of valid currencies from fixedCurrencyRates
            const validCurrencies = new Set<string>();
            const decimals: Record<string, number> = {};
            (response.fixedCurrencyRates?.items || []).forEach(({currency, decimals: dec}: {currency: string; decimals: number}) => {
                validCurrencies.add(currency);
                decimals[currency] = dec;
            });
            setDecimalsPerCurrency(decimals);

            // Filter exchangedPrizeValues to only include currencies from fixedCurrencyRates
            const values = (response.exchangedPrizeValues || []).filter(
                ({currency}: {currency: string}) => validCurrencies.has(currency)
            );
            setExchangedValues(values);

            // Auto-prefill: use existing overrides or calculated values
            const newOverrides: Record<string, number> = {};
            values.forEach(({currency, exchangedValue}: ExchangedValue) => {
                const value = currencyOverrides[currency] ?? exchangedValue;
                const dec = decimals[currency] ?? 2;
                newOverrides[currency] = parseFloat(value.toFixed(dec));
            });
            setLocalOverrides(newOverrides);
        } catch (error) {
            console.error("Failed to fetch exchanged values:", error);
        }
        setLoading(false);
    };

    const handleValueChange = (currency: string, value: number | null) => {
        if (value !== null) {
            setLocalOverrides({...localOverrides, [currency]: value});
        }
    };

    const handleSave = () => {
        // Round values to proper decimal places before saving
        const roundedOverrides: Record<string, number> = {};
        for (const [currency, value] of Object.entries(localOverrides)) {
            const decimals = getDecimals(currency);
            roundedOverrides[currency] = parseFloat(value.toFixed(decimals));
        }
        onChange(roundedOverrides);
        setIsModalOpen(false);
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    return (
        <>
            <Tooltip title={overrideCount > 0 ? `${overrideCount} currency override(s)` : "Define per-currency values"}>
                <Button type="dashed" style={{width: 50, marginTop: 30, marginRight: 20, marginLeft: 0}} icon={<DollarOutlined style={{color: overrideCount > 0 ? "#1890ff" : undefined}} />} onClick={() => setIsModalOpen(true)} disabled={disabled} />
            </Tooltip>

            <Modal
                title="Currency Overrides"
                open={isModalOpen}
                onCancel={handleCancel}
                footer={[
                    <Button key="cancel" onClick={handleCancel}>
                        Cancel
                    </Button>,
                    <Button key="save" type="primary" onClick={handleSave} disabled={disabled}>
                        Save
                    </Button>,
                ]}
                width={650}
            >
                {loading ? (
                    <div style={{textAlign: "center", padding: 20}}>
                        <Spin />
                    </div>
                ) : (
                    <>
                        <div style={{marginBottom: 16}}>
                            <span style={{color: "#888"}}>
                                Base value: {baseValue.toFixed(getDecimals(env.VITE_BASE_CURRENCY))} {env.VITE_BASE_CURRENCY}
                            </span>
                        </div>

                        {exchangedValues.length > 0 && (
                            <Table
                                size="small"
                                dataSource={exchangedValues}
                                rowKey="currency"
                                pagination={false}
                                columns={[
                                    {
                                        title: "Currency",
                                        dataIndex: "currency",
                                        width: 80,
                                        render: (currency: string) => <span style={{fontWeight: 500}}>{currency}</span>,
                                    },
                                    {
                                        title: "Value",
                                        dataIndex: "currency",
                                        width: 140,
                                        render: (currency: string) => {
                                            const decimals = getDecimals(currency);
                                            const step = Math.pow(10, -decimals);
                                            return (
                                                <InputNumber
                                                    value={localOverrides[currency]}
                                                    onChange={value => handleValueChange(currency, value)}
                                                    disabled={disabled}
                                                    step={step}
                                                    min={0}
                                                    precision={decimals}
                                                    style={{width: 120}}
                                                />
                                            );
                                        },
                                    },
                                    {
                                        title: `Value (${env.VITE_BASE_CURRENCY})`,
                                        dataIndex: "rate",
                                        width: 120,
                                        render: (rate: number, record: ExchangedValue) => {
                                            const enteredValue = localOverrides[record.currency] || 0;
                                            const valueInBase = rate !== 0 ? enteredValue / rate : 0;
                                            const baseDecimals = getDecimals(env.VITE_BASE_CURRENCY);
                                            return <span style={{color: "#888"}}>{valueInBase.toFixed(baseDecimals)}</span>;
                                        },
                                    },
                                    {
                                        title: "Ratio",
                                        dataIndex: "rate",
                                        width: 80,
                                        render: (rate: number, record: ExchangedValue) => {
                                            const enteredValue = localOverrides[record.currency] || 0;
                                            const valueInBase = rate !== 0 ? enteredValue / rate : 0;
                                            const ratio = baseValue > 0 ? ((valueInBase - baseValue) / baseValue) * 100 : 0;
                                            const color = ratio > 0 ? "#52c41a" : ratio < 0 ? "#ff4d4f" : "#888";
                                            const prefix = ratio > 0 ? "+" : "";
                                            return <span style={{color}}>{prefix}{ratio.toFixed(1)}%</span>;
                                        },
                                    },
                                ]}
                            />
                        )}

                        {exchangedValues.length === 0 && baseValue > 0 && <div style={{color: "#888", textAlign: "center", padding: 20}}>No other currencies available</div>}

                        {baseValue <= 0 && <div style={{color: "#888", textAlign: "center", padding: 20}}>Enter a base value to see currency conversions</div>}
                    </>
                )}
            </Modal>
        </>
    );
};

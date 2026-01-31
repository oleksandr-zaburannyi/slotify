import {Button, DatePicker, Form, message, Select, Space, Switch, Tooltip} from "antd";
import React, {useRef} from "react";
import {Link} from "react-router-dom";
import {InfoCircleOutlined, PlayCircleOutlined, RedoOutlined} from "@ant-design/icons";
import {DataTable, tableFilter} from "../components/DataTable";
import {ExportButton} from "../components/Buttons";
import env from "../lib/env";
import {useAppState} from "../lib/AppProvider";
import useStateParams from "../lib/useStateParams";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {AppModal} from "../App";
import {getForm} from "../utils/getForm";
import {gql} from "graphql-request";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import Currency from "../components/Currency";
import {timezones} from "../constants/timezones";

dayjs.extend(utc);
dayjs.extend(timezone);

const intervals: any[] = [
    // {title: "Hour", group: true, dataIndex: "hour", sorter: true, ...tableFilter("LIKE"), picker: "date"},
    {title: "Day", group: true, dataIndex: "day", sorter: true, picker: "date", ellipsis: {}},
    {title: "Month", group: true, dataIndex: "month", sorter: true, picker: "month", ellipsis: {}},
    {title: "Year", group: true, dataIndex: "year", sorter: true, picker: "year", ellipsis: {}},
];

const RegenerateButton = () => {
    const [form] = Form.useForm();
    const fetcher = useGraphQlFetcher();
    const content = (
        <Space.Compact>
            <Form.Item label="Date" name="date" required={false} rules={[{required: true}]}>
                <DatePicker
                    disabledDate={current => {
                        return current && current > dayjs().endOf("day");
                    }}
                />
            </Form.Item>
        </Space.Compact>
    );
    const handleOnClick = () => {
        AppModal().info({
            centered: true,
            width: 400,
            icon: null,
            okText: "Regenerate",
            okCancel: true,
            content: getForm(form, content),
            onOk: async () => {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(async ({date}) => {
                            fetcher([
                                gql`
                                    mutation ($date: String!) {
                                        regenerateGameWin(date: $date)
                                    }
                                `,
                                {date: date.format("YYYY-MM-DD")},
                            ])
                                .then(() => {
                                    message.success("Regeneration process has started");
                                    resolve(true);
                                })
                                .catch(reject);
                        })
                        .catch(reject);
                });
            },
        });
    };
    return (
        <Button type={"default"} onClick={handleOnClick} icon={<RedoOutlined />}>
            Regenerate
        </Button>
    );
};

const GameWin = () => {
    const [state] = useAppState();
    const initialValues = {dimensions: ["wallet", "excluded", "category"], time: [dayjs().utc().format("YYYY-MM-DD"), dayjs().utc().format("YYYY-MM-DD")], interval: "day", convert: true, timezone: "UTC"};
    const dataTable = useRef(null);
    const [params, setParams] = useStateParams<typeof initialValues>(
        initialValues,
        "options",
        state => JSON.stringify(state),
        state => JSON.parse(state),
    );
    const safeTimezone = params.timezone && timezones.some(tz => tz.value === params.timezone) ? params.timezone : initialValues.timezone;

    const columns: any[] = [
        {title: "Wallet", group: true, dataIndex: "wallet", sorter: true, ...tableFilter("LIKE"), ellipsis: {}},
        {
            title: "Excluded",
            group: true,
            dataIndex: "excluded",
            sorter: true,
            ...tableFilter("IN", [
                {name: "true", value: true},
                {name: "false", value: false},
            ]),
            render: (value: boolean) => value?.toString(),
            ellipsis: {},
        },
        {title: "Wallet group", group: true, dataIndex: "walletGroup", sorter: true, ...tableFilter("LIKE"), ellipsis: {}},
        {title: "Player group", group: true, dataIndex: "playerGroup", sorter: true, ...tableFilter("LIKE"), ellipsis: {}},
        {title: "Operator", group: true, dataIndex: "operator", sorter: true, ...tableFilter("LIKE")},
        {title: "Brand", group: true, dataIndex: "brand", sorter: true, ...tableFilter("LIKE")},
        {title: "Jurisdiction", group: true, dataIndex: "jurisdiction", sorter: true, ...tableFilter("LIKE")},
        {title: "RGS", group: true, dataIndex: "rgs", sorter: true, ...tableFilter("LIKE")},
        {title: "Provider", group: true, dataIndex: "provider", sorter: true, ...tableFilter("LIKE")},
        {title: "Game", group: true, dataIndex: "game", sorter: true, ...tableFilter("LIKE")},
        {title: "Game title", group: true, dataIndex: "gameTitle", sorter: true, ...tableFilter("LIKE")},
        {title: "Variant", group: true, dataIndex: "variant", sorter: true, ...tableFilter("LIKE")},
        {title: "Player Id", group: true, dataIndex: "playerId", render: (playerId: string) => playerId && <Link to={`/players/${playerId}`}>{playerId}</Link>, sorter: true, ...tableFilter("EQUAL")},
        {title: "Native Id", group: true, dataIndex: "nativeId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Category", group: true, dataIndex: "category", sorter: true, ...tableFilter("LIKE")},
        {title: "Country", group: true, dataIndex: "country", sorter: true, ...tableFilter("LIKE")},
        {title: "Name", group: true, dataIndex: "name", sorter: true, ...tableFilter("LIKE")},
        {title: "Channel", group: true, dataIndex: "channel", sorter: true, ...tableFilter("LIKE")},
        {title: "Campaign Id", group: true, dataIndex: "campaignId", sorter: true, ...tableFilter("EQUAL")},
        {title: "Campaign Type", group: true, dataIndex: "campaignType", sorter: true, ...tableFilter("LIKE")},
        {title: "Exclusion Reason", group: true, dataIndex: "exclusionReason", ...tableFilter("LIKE")},
        {title: "Players", dataIndex: "players", sorter: true},
        {title: "Bets", dataIndex: "bets", sorter: true},
        {title: "Wins", dataIndex: "wins", sorter: true},
        {title: "Currency", dataIndex: "currency", ...tableFilter("LIKE")},
        {title: "Exchange Rate", dataIndex: "currencyExchangeRate", render: (value: number, {currency}: any) => <Currency currency={currency} amount={value} />, group: true},
        {title: "Total bet", dataIndex: "totalBet", sorter: true, render: (value: number, {currency}: any) => <Currency currency={currency} amount={value} />},
        {title: "Total win", dataIndex: "totalWin", sorter: true, render: (value: number, {currency}: any) => <Currency currency={currency} amount={value} />},
        {title: "Jackpot contribution", dataIndex: "jackpotContribution", sorter: true, render: (value: number, {currency}: any) => <Currency currency={currency} amount={value} />},
        {title: "Jackpot win", dataIndex: "jackpotWin", sorter: true, render: (value: number, {currency}: any) => <Currency currency={currency} amount={value} />},
        {
            title: (
                <>
                    Game Win{" "}
                    <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={"Game Win = (Total bet - Jackpot contributions) - (Total win - Jackpot Win)"}>
                        <InfoCircleOutlined />
                    </Tooltip>
                </>
            ),
            dataIndex: "gameWin",
            sorter: true,
            render: (value: number, {currency}: any) => <Currency currency={currency} amount={value} />,
        },
        {
            title: (
                <>
                    RTP{" "}
                    <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={"RTP = Total win / Total bet * 100%"}>
                        <InfoCircleOutlined />
                    </Tooltip>
                </>
            ),
            dataIndex: "rtp",
            sorter: true,
            render: (value: string) => (parseFloat(value) * 100).toFixed(2) + "%",
        },
        {
            title: (
                <>
                    Normalised RTP{" "}
                    <Tooltip placement={"left"} overlayStyle={{maxWidth: "500px"}} title={"Same as RTP but assumes all bets are equal"}>
                        <InfoCircleOutlined />
                    </Tooltip>
                </>
            ),
            dataIndex: "normalisedRtp",
            sorter: true,
            render: (value: string) => (parseFloat(value) * 100).toFixed(2) + "%",
        },
    ];

    function onSubmit(newParams: typeof initialValues) {
        newParams = {...newParams, time: newParams.time.map(time => dayjs(time).format("YYYY-MM-DD"))};
        if (JSON.stringify(params) !== JSON.stringify(newParams)) {
            setParams(newParams);
        } else {
            (dataTable?.current as any)?.revalidate();
        }
    }

    return (
        <>
            <Form layout={"inline"} onFinish={onSubmit} initialValues={{...params, time: params.time.map(time => dayjs(time))}}>
                <Form.Item style={{marginBottom: 10}} label={"Interval"} name="interval" labelCol={{style: {flex: "0 0 60px"}}}>
                    <Select key={"select"} style={{width: "100px"}}>
                        {intervals.map(column => (
                            <Select.Option key={column.dataIndex} value={column.dataIndex}>
                                {column.title}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item style={{marginBottom: 10}} label={"Time"} name="time" labelCol={{style: {flex: "0 0 40px"}}}>
                    <DatePicker.RangePicker
                        allowClear={false}
                        presets={[
                            {label: "Today", value: [dayjs().startOf("day"), dayjs().endOf("day")]},
                            {label: "Yesterday", value: [dayjs().startOf("day").subtract(1, "day"), dayjs().endOf("day").subtract(1, "day")]},
                            {label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("month")]},
                            {label: "Last Month", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")]},
                        ]}
                    />
                </Form.Item>
                <Form.Item style={{marginBottom: 10}} label={"Timezone"} name="timezone" labelCol={{style: {flex: "0 0 70px"}}}>
                    <Select showSearch optionFilterProp="children" style={{width: "230px"}}>
                        {timezones.map(tz => (
                            <Select.Option key={tz.value} value={tz.value}>
                                {tz.label}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item style={{marginBottom: 10, marginRight: 50}} label={"Dimensions"} name="dimensions" labelCol={{style: {flex: "0 0 85px"}}}>
                    <Select key={"select"} mode="multiple" placeholder="Please select" style={{width: "260px"}} maxTagCount={2}>
                        {columns
                            .filter(column => column.group)
                            .map(column => (
                                <Select.Option key={column.dataIndex} value={column.dataIndex}>
                                    {column.title}
                                </Select.Option>
                            ))}
                    </Select>
                </Form.Item>
                <Form.Item style={{marginBottom: 10}} label={`Convert to ${env.VITE_BASE_CURRENCY.toUpperCase()}`} name="convert" valuePropName="checked" labelCol={{style: {flex: "0 0 110px"}}}>
                    <Switch style={{width: 40}} />
                </Form.Item>
                <div style={{width: "100%"}} />
                <Form.Item style={{marginBottom: 10}}>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />}>
                        Run
                    </Button>
                </Form.Item>

                {state?.account?.permissions?.includes("regenerateGameWin") && (
                    <Form.Item style={{marginBottom: 10}}>
                        <RegenerateButton />
                    </Form.Item>
                )}
                <Form.Item style={{marginBottom: 10}}>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
            </Form>
            <DataTable
                ref={dataTable}
                queryName={"gameWin"}
                options={params}
                columns={[intervals.find(interval => interval.dataIndex === params.interval), ...columns.filter(column => params.dimensions.includes(column.dataIndex) || !column.group)]}
                filter={[
                    {type: "GREATER_OR_EQUAL", field: "date", value: dayjs.tz(params.time[0], safeTimezone).startOf("day").utc().format("YYYY-MM-DD HH:mm:ss")},
                    {type: "LOWER", field: "date", value: dayjs.tz(params.time[1], safeTimezone).add(1, "day").startOf("day").utc().format("YYYY-MM-DD HH:mm:ss")},
                ]}
            />
        </>
    );
};
export default GameWin;

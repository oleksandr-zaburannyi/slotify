import {gql} from "graphql-request";
import React, {useMemo} from "react";
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import useSWR from "swr";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import dayjs from "dayjs";

const DailyGameWinChart = () => {
    const query = gql`
        query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
            gameWin(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
                items {
                    day
                    gameWin
                }
            }
        }
    `;

    const vars = useMemo(
        () => ({
            filter: [
                {type: "GREATER_OR_EQUAL", field: "date", value: dayjs().add(-7, "days").format("YYYY-MM-DD")},
                {type: "LOWER", field: "date", value: dayjs().format("YYYY-MM-DD")},
                {type: "EQUAL", field: "excluded", value: false},
            ],
            options: {convert: true, interval: "day", dimensions: []},
            limit: 7,
            sort: {field: "day", order: "ASC"},
        }),
        [],
    );

    const {data} = useSWR([query, vars], useGraphQlFetcher(), {revalidateOnFocus: false});

    return (
        <ResponsiveContainer width="100%" aspect={3}>
            <LineChart data={data?.gameWin.items} margin={{top: 5, right: 20, left: 10, bottom: 5}}>
                <XAxis dataKey="day" tickFormatter={tick => dayjs(tick).format("DD/MM")} />
                <YAxis dataKey="gameWin" tickFormatter={tick => `€${Math.round(tick / 1000)}k`} />
                <Tooltip formatter={(value: any) => value.toLocaleString("en-US", {style: "currency", currency: "EUR", minimumFractionDigits: 2})} />
                <CartesianGrid stroke="#f5f5f5" />
                <Line type="monotone" dataKey="gameWin" stroke="#007bff" isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default DailyGameWinChart;

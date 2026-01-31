import {gql} from "graphql-request";
import React, {useMemo} from "react";
import {Button, Card, Col, Row} from "antd";
import useSWR from "swr";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import dayjs from "dayjs";

interface IStatCard {
    type?: "fill";
    title: string;
    dimension: string;
    icon: React.JSX.Element;
    color: string;
}

const StatCard = ({type, title, dimension, icon, color}: IStatCard) => {
    const query = gql`query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
        gameWin(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
            items {
                ${dimension}
            }
        }
    }`;

    const vars = useMemo(
        () => ({
            filter: [
                {type: "GREATER_OR_EQUAL", field: "date", value: dayjs().add(-7, "days").format("YYYY-MM-DD")},
                {type: "LOWER", field: "date", value: dayjs().format("YYYY-MM-DD")},
                {type: "EQUAL", field: "excluded", value: false},
            ],
            limit: 100 * 1000,
            options: {convert: true, dimensions: [dimension]},
        }),
        [],
    );

    const {data} = useSWR([query, vars], useGraphQlFetcher(), {revalidateOnFocus: false});

    let before = null,
        after = null;

    const cardIcon = (
        <Col>
            <Button shape="circle" size="large" type="primary" style={{backgroundColor: color, borderColor: color, cursor: "auto"}} className={type !== "fill" ? "mr-4" : undefined}>
                {icon}
            </Button>
        </Col>
    );

    if (icon) {
        type === "fill" ? (after = cardIcon) : (before = cardIcon);
    }

    return (
        <Card className="mb-4" style={type === "fill" ? {backgroundColor: color} : undefined}>
            <Row align="middle" justify="start">
                {before}
                <Col>
                    <h5 className={`mb-0 ${type === "fill" ? "text-white" : undefined}`}>{data?.gameWin.items.length}</h5>
                    <span className={type === "fill" ? "text-white-50" : undefined}>{title}</span>
                </Col>
                <span className="mr-auto" />
                {after}
            </Row>
        </Card>
    );
};

export default StatCard;

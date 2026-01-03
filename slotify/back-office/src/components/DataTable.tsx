import {Button, Checkbox, DatePicker, Form, Input, Space, Table} from "antd";
import {ColumnsType} from "antd/lib/table/interface";
import {gql} from "graphql-request";
import React, {forwardRef, useEffect, useImperativeHandle, useState} from "react";
import Highlighter from "react-highlight-words";
import useSWR from "swr";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {SearchOutlined} from "@ant-design/icons";
import useStateParams from "../lib/useStateParams";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export const tableFilter = (type: "IN" | "EQUAL" | "LIKE" | "STARTS_WITH" | "DATE" | "TIME", values: {name: string; value: any}[] = []) => ({
    filterDropdown: ({setSelectedKeys, selectedKeys, confirm}: any) => (
        <div style={{padding: 8}}>
            {(type === "LIKE" || type === "EQUAL" || type === "STARTS_WITH") && (
                <Form.Item style={{width: 188, marginBottom: 8, display: "block"}}>
                    {type === "LIKE" && "Contains:"}
                    {type === "EQUAL" && "Equals:"}
                    {type === "STARTS_WITH" && "Starts with:"}
                    <Input
                        allowClear={false}
                        placeholder={`Search`}
                        value={type === "LIKE" || type === "STARTS_WITH" ? selectedKeys?.toString().replace(/%/g, "") : selectedKeys?.toString()}
                        onChange={e => {
                            let value = e.target.value ? e.target.value.toString() : null;
                            if (type === "LIKE") value = `%${e.target.value}%`;
                            if (type === "STARTS_WITH") value = `${e.target.value}%`;
                            setSelectedKeys(value);
                        }}
                        onPressEnter={event => {
                            event.stopPropagation();
                            confirm();
                        }}
                        autoFocus={true}
                    />
                </Form.Item>
            )}

            {type === "IN" && (
                <Checkbox.Group style={{width: 188, marginBottom: 8, display: "block"}} onChange={values => setSelectedKeys(values)} value={selectedKeys}>
                    {values.map(({value, name}) => (
                        <Form.Item style={{marginBottom: -5}} key={value.toString()}>
                            <Checkbox value={value}>{name.toString()}</Checkbox>
                        </Form.Item>
                    ))}
                </Checkbox.Group>
            )}

            {(type === "DATE" || type === "TIME") && (
                <Form>
                    <Form.Item name="range-picker" style={{width: type === "DATE" ? 258 : 328, marginBottom: 8, display: "block"}} initialValue={selectedKeys ? selectedKeys : []}>
                        <DatePicker.RangePicker
                            onChange={date => setSelectedKeys(date)}
                            value={selectedKeys ? selectedKeys : []}
                            allowClear={false}
                            format={type === "DATE" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm"}
                            showTime={type === "TIME" ? {defaultValue: [dayjs("00:00", "HH:mm"), dayjs("23:59", "HH:mm")], showSecond: false} : false}
                            presets={[
                                {label: "Today", value: [dayjs().startOf("day"), dayjs().endOf("day")]},
                                {label: "Yesterday", value: [dayjs().startOf("day").subtract(1, "day"), dayjs().endOf("day").subtract(1, "day")]},
                                {label: "This Month", value: [dayjs().startOf("month"), dayjs().endOf("month")]},
                                {label: "Last Month", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().endOf("month").subtract(1, "month")]},
                            ]}
                        />
                    </Form.Item>
                </Form>
            )}

            <Space>
                <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{width: 90}}>
                    Search
                </Button>
                <Button
                    onClick={() => {
                        setSelectedKeys(null);
                        confirm();
                    }}
                    size="small"
                    style={{width: 90}}
                >
                    Reset
                </Button>
            </Space>
        </div>
    ),
    filterType: type === "STARTS_WITH" ? "LIKE" : type,
    filterIcon: (filtered: boolean) => <SearchOutlined style={{color: filtered ? "#1890ff" : undefined}} />,
});

type IFilterType = "IN" | "EQUAL" | "NOT_EQUAL" | "LIKE" | "GREATER" | "GREATER_OR_EQUAL" | "LOWER" | "LOWER_OR_EQUAL" | "NULL" | "NOT_NULL" | "CONTAIN";

interface IFilter {
    type: IFilterType;
    field: string;
    jsonField?: string | undefined;
    value: string | [string, string];
}

interface ISort {
    order: "ASC" | "DESC";
    field: string;
}

export type IDataTableColumn = {render?: (value: any, data?: any, highlight?: string) => any; filterType: string; dataIndex: string; hidden?: boolean; jsonField?: string; title?: string} & ColumnsType<any>;

interface IDataTableParams {
    columns: IDataTableColumn[];
    queryName: string;
    filter?: IFilter[];
    options?: any;
    sort?: ISort;
}

function removeCustomFilter(variables: any) {
    const {customFilter, ...vars} = variables;
    return vars;
}

export const DataTable = forwardRef(({columns, queryName, filter, options, sort}: IDataTableParams, ref) => {
    const query = gql`query ($limit: Int, $offset: Int, $sort: Sort, $filter: [Filter], $options: JSONObject) {
        gameWin(limit: $limit, sort: $sort, offset: $offset, filter: $filter, options: $options) {
            meta {
                hasPrev hasNext total
            }
            items {
                ${columns.map((column: any) => column.dataIndex).join(" ")}
            }
        }
    }`.replace("gameWin", queryName);

    const [variables, setVariables] = useStateParams<any>(
        {limit: 10, offset: 0, sort, filter, options: structuredClone(options), customFilter: []},
        queryName,
        state => JSON.stringify(state),
        state => JSON.parse(state),
    );

    const fetcher = useGraphQlFetcher();
    const [customFilter, setCustomFilter] = useState<any[]>(variables.customFilter);
    const {data, isValidating, mutate, error} = useSWR([query, removeCustomFilter(variables)], fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});
    const [{items, meta}, setResults] = useState<any>({items: [], meta: {}});
    const [initialState, setInitialState] = useState({options, filter, sort});
    useEffect(() => {
        if (!error && data) {
            setResults({items: data[queryName].items, meta: data[queryName].meta});
        }
    }, [data]);

    useEffect(() => {
        const newInitialState = {options, filter, sort};
        if (JSON.stringify(newInitialState) !== JSON.stringify(initialState)) {
            setVariables({...variables, options, filter: filter || [], customFilter});
            setInitialState(newInitialState);
        }
    }, [options, filter]);

    useImperativeHandle(ref, () => ({
        revalidate: async () => await mutate(),
        getData: async (limit: number, offset: number) => await fetcher([query, {...removeCustomFilter(variables), limit, offset}]),
    }));

    return (
        <>
            <Table
                columns={columns.filter(column => !column.hidden).map(column => mapColumns(column, variables.sort, (variables.filter || []).concat(variables.customFilter || [])))}
                showSorterTooltip={false}
                dataSource={items}
                loading={isValidating}
                rowKey={Math.random}
                size={"small"}
                pagination={
                    items?.length > 0 && {
                        total: meta.total || variables.offset + (meta.hasNext ? variables.limit + 1 : items.length),
                        current: meta.total || meta.hasPrev ? variables.offset / variables.limit + 1 : 1,
                        showSizeChanger: true,
                        pageSizeOptions: ["1", "10", "20", "50", "100", "500", "1000"],
                        pageSize: variables.limit,
                        showTotal: (total: number, range: [number, number]) => `Displaying ${range[0]} -${range[1]} of ${meta.total !== null || !meta.hasNext ? total : "..."}`,
                    }
                }
                sortDirections={["descend", "ascend", "descend"]}
                scroll={{x: true}}
                onChange={({current = 1, pageSize = 10}, dataFilter, sorter: any) => {
                    const orders: any = {"ascend": "ASC", "descend": "DESC"};
                    const customFilter = Object.keys(dataFilter)
                        .filter(field => dataFilter[field])
                        .map(field => {
                            const column = columns.find(c => field === c.dataIndex + "_" + c.jsonField)!;
                            return mapFilters(column.dataIndex, dataFilter[field], column.filterType!, column.jsonField);
                        })
                        .flat();
                    setVariables({
                        ...variables,
                        customFilter,
                        limit: pageSize,
                        offset: (current - 1) * pageSize,
                        sort: sorter?.order ? {field: sorter.field, order: orders[sorter.order]} : null,
                        filter: customFilter.concat((filter as any) || []),
                    });
                    setCustomFilter(customFilter);
                }}
            />
        </>
    );
});

const mapColumns = (column: IDataTableColumn, sorter: any, filter: any) => {
    const columnFilter = filter?.filter((f: any) => f.field === column.dataIndex && f.jsonField === column.jsonField);
    const shouldHighlight = ["LIKE", "EQUAL", "CONTAIN"].includes(columnFilter[0]?.type);
    const highlight = shouldHighlight ? columnFilter[0]?.value?.replace(/%/g, "") : null;
    const highlightedRender = (text: string) => (shouldHighlight ? <Highlighter highlightStyle={{backgroundColor: "#ffc069", padding: 0}} searchWords={[highlight]} autoEscape textToHighlight={text ? text.toString() : ""} /> : text);

    const orders: any = {"ASC": "ascend", "DESC": "descend"};

    let filteredValue = null;
    if (columnFilter.length > 0) {
        if (["DATE", "TIME"].includes(column.filterType)) {
            filteredValue = [dayjs.utc(columnFilter[0].value).local(), dayjs.utc(columnFilter[1].value).local()];
        } else {
            filteredValue = columnFilter[0].value;
        }
    }

    const sortOrder = column.dataIndex === sorter?.field ? orders[sorter?.order] : null;
    return {
        defaultSortOrder: sortOrder,
        sortOrder,
        ellipsis: true,
        filteredValue,
        ...column,
        key: column.dataIndex + "_" + column.jsonField,
        render: (text: any, data: any) => {
            text = column.jsonField ? text[column.jsonField] : text;
            return (column.render && column.render(text, data, highlight)) || highlightedRender(text);
        },
    };
};

const mapFilters = (field: string, value: any, type: string, jsonField?: string) => {
    switch (type) {
        case "DATE":
            return [
                {type: "GREATER_OR_EQUAL", field, jsonField, value: dayjs(value[0]).format("YYYY-MM-DD")},
                {type: "LOWER_OR_EQUAL", field, jsonField, value: dayjs(value[1]).format("YYYY-MM-DD")},
            ];
        case "TIME":
            return [
                {type: "GREATER_OR_EQUAL", field, jsonField, value: dayjs(value[0]).utc().format("YYYY-MM-DD HH:mm")},
                {type: "LOWER_OR_EQUAL", field, jsonField, value: dayjs(value[1]).utc().format("YYYY-MM-DD HH:mm")},
            ];
        default:
            return {field, jsonField, value, type};
    }
};

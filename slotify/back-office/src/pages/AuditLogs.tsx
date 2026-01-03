import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, Modal} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton} from "../components/Buttons";
import StatusTag from "../components/StatusTag";
import JsonView from "react18-json-view";
import IpAddress from "../components/IpAddress";

const AuditLogs = () => {
    const dataTable = useRef(null);

    const columns: any[] = [
        {title: "Date", dataIndex: "date", render: (createdAt: string) => new Date(createdAt).toLocaleString(), sorter: true, ...tableFilter("TIME")},
        {title: "Email", dataIndex: "email", sorter: true, ...tableFilter("LIKE")},
        {title: "Type", dataIndex: "type", sorter: true, ...tableFilter("LIKE")},
        {title: "Action", dataIndex: "action", sorter: true, ...tableFilter("LIKE")},
        {
            title: "Query",
            dataIndex: "query",
            ...tableFilter("LIKE"),
            render: (query: string) =>
                query && (
                    <Button size={"small"} onClick={() => Modal.info({content: <pre>{query}</pre>, icon: null})}>
                        Show
                    </Button>
                ),
        },
        {title: "Variables", dataIndex: "variables", ...tableFilter("LIKE"), render: (data: any) => data && <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {
            title: "Result",
            dataIndex: "result",
            ...tableFilter("LIKE"),
            render: (data: any) => data && <JsonView collapsed={true} enableClipboard={false} src={data instanceof Object ? data : {result: data}} />,
        },
        {
            title: "Success",
            dataIndex: "success",
            sorter: true,
            render: (value: boolean) => <StatusTag status={value.toString()} />,
            ...tableFilter("IN", [
                {name: "true", value: true},
                {name: "false", value: false},
            ]),
        },
        {title: "IP", dataIndex: "ip", sorter: true, render: (ip?: string) => <IpAddress ip={ip} />},
        {title: "Whitelisted IP", dataIndex: "isIpWhitelisted", sorter: true, render: (value: boolean) => value !== null && <StatusTag status={value.toString()} />},
    ];

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={() => (dataTable?.current as any)?.revalidate()}>
                        Refresh
                    </Button>
                </Form.Item>
                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
            </Form>
            <DataTable ref={dataTable} queryName={"auditLogs"} columns={columns} sort={{field: "date", order: "DESC"}} />
        </>
    );
};
export default AuditLogs;

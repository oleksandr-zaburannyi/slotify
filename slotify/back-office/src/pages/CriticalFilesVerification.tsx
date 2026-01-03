import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Form, Tag} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ExportButton} from "../components/Buttons";

const CriticalFilesVerification = () => {
    const columns: any[] = [
        {title: "Date", dataIndex: "createdAt", sorter: true, render: (createdAt: number) => new Date(createdAt).toLocaleString(), ...tableFilter("TIME")},
        {title: "File Id", dataIndex: "fileId", hidden: true},
        {title: "Name", dataIndex: "name", sorter: true, ...tableFilter("LIKE")},
        {title: "Component", dataIndex: "component", sorter: true, ...tableFilter("LIKE")},
        {
            title: "Success",
            dataIndex: "success",
            sorter: true,
            render: (isCorrect: boolean) => <Tag color={isCorrect ? "green" : "red"}>{isCorrect ? "true" : "false"}</Tag>,
            ...tableFilter("IN", [
                {name: "true", value: true},
                {name: "false", value: false},
            ]),
        },
        {title: "Logged checksum", dataIndex: "loggedChecksum", sorter: true, ...tableFilter("LIKE"), render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Declared checksum", dataIndex: "declaredChecksum", sorter: true, ...tableFilter("LIKE"), render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
    ];

    const dataTable = useRef(null);

    const refresh = () => {
        (dataTable?.current as any)?.revalidate();
    };

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: 20}}>
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={refresh}>
                        Refresh
                    </Button>
                </Form.Item>

                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
            </Form>

            <DataTable ref={dataTable} queryName={"criticalFilesVerification"} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};

export default CriticalFilesVerification;

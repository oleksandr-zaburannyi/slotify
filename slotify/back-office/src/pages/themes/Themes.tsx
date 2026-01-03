import React, {useRef} from "react";
import {DataTable, tableFilter} from "../../components/DataTable";
import {Button, Form} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {DeleteButton, ExportButton, ImportButton} from "../../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../../lib/AppProvider";
import {campaignTypes} from "../promo/campaignTypes";
import AddThemeButton from "./AddThemeButton";

const Themes = () => {
    const [state] = useAppState();

    const columns: any[] = [
        {
            title: "Created at",
            dataIndex: "createdAt",
            sorter: true,
            ...tableFilter("DATE"),
            render: (date: any) => (date ? new Date(date).toLocaleString() : ""),
        },
        {title: "Theme ID", dataIndex: "themeId", hidden: true},
        {title: "Name", dataIndex: "name", ...tableFilter("LIKE")},
        {
            title: "Campaign Type",
            dataIndex: "campaignType",
            ...tableFilter(
                "IN",
                Object.entries(campaignTypes).map(([value, tool]) => ({value, name: tool.name})),
            ),
            render: (type: string) => (campaignTypes[type] ? campaignTypes[type].name : type),
        },
        {
            title: "Translations",
            dataIndex: "translations",
            hidden: true,
        },
        {
            title: "Icons",
            dataIndex: "icons",
            hidden: true,
        },
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageThemes") && <AddThemeButton onSuccess={refresh} edit={true} theme={data} />}
                    {state?.account?.permissions?.includes("manageThemes") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($themeId: ID!) {
                                            deleteTheme(themeId: $themeId)
                                        }
                                    `,
                                    {themeId: data.themeId},
                                ])
                            }
                        />
                    )}
                </>
            ),
        },
    ];

    const dataTable = useRef(null);

    const refresh = () => {
        (dataTable?.current as any)?.revalidate();
    };

    return (
        <>
            <Form layout={"inline"} style={{marginBottom: "20px"}}>
                {state?.account?.permissions?.includes("manageThemes") && (
                    <Form.Item>
                        <AddThemeButton onSuccess={refresh} />
                    </Form.Item>
                )}
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={refresh}>
                        Refresh
                    </Button>
                </Form.Item>
                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>
                {state?.account?.permissions?.includes("manageThemes") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importThemes"} />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"themes"} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};
export default Themes;

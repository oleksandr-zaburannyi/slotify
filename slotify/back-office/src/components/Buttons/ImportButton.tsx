import React, {FC, useState} from "react";
import {Button, message, Upload} from "antd";
import {UploadOutlined} from "@ant-design/icons";
import useGraphQlFetcher from "../../lib/useGraphQlFetcher";
import {gql} from "graphql-request";

const ImportButton: FC<{dataTable: any; importMutation: string}> = ({dataTable, importMutation}: any) => {
    const fetcher = useGraphQlFetcher();
    const [loading, setLoading] = useState(false);
    return (
        <Upload
            accept={".csv, text/csv"}
            name={"*.csv"}
            beforeUpload={file => {
                setLoading(true);
                const reader = new FileReader();
                reader.onload = e => {
                    const data = e.target?.result as string;

                    fetcher([
                        gql`
                            mutation ($data: String!) {
                                importSettings(data: $data) {
                                    added
                                    edited
                                }
                            }
                        `.replace("importSettings", importMutation),
                        {data},
                    ]).then(({[importMutation]: {added, edited}}) => {
                        (dataTable.current as any)?.revalidate();
                        message.success(`Successfully added ${added} and edited ${edited} items`).then(() => null);
                    });
                };
                reader.onloadend = () => {
                    setLoading(false);
                };
                reader.readAsText(file);
                return false;
            }}
            showUploadList={false}
        >
            <Button type={"dashed"} disabled={loading} icon={<UploadOutlined />}>
                Import
            </Button>
        </Upload>
    );
};
export default ImportButton;

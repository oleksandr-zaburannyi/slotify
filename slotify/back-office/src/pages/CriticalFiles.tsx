import React, {useRef, useState} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import StatusTag from "../components/StatusTag";
import {Button, Divider, Form, Input, message, Modal, Select, Space, Tooltip} from "antd";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {InfoCircleOutlined, PlayCircleOutlined} from "@ant-design/icons";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {ImportButton, ExportButton} from "../components/Buttons";
import TagList from "../components/TagList";

const withRemovedEmptyArrays = (data: any) => (!data?.jurisdictions || data?.jurisdictions.length === 0 ? {...data, jurisdictions: undefined} : {...data});

const withNullifiedEmptyArrays = (data: any) => (!data?.jurisdictions || data?.jurisdictions.length === 0 ? {...data, jurisdictions: null} : {...data});

const Content = ({data}: any) => {
    const [origin, setOrigin] = useState(data?.origin || "local");

    return (
        <>
            <Divider>Identification</Divider>

            <Space.Compact>
                <Form.Item label="Name" name="name" rules={[{required: true, message: "File name is required"}]} style={{width: "250px"}}>
                    <Input type="text" placeholder="File name" style={{width: "230px"}} />
                </Form.Item>

                <Form.Item label="Component" name="component" rules={[{required: true, message: "Component name is required"}]} style={{width: "250px"}}>
                    <Input type="text" placeholder="Component name" style={{width: "230px"}} />
                </Form.Item>
            </Space.Compact>

            <Divider>File Location</Divider>

            <Form.Item initialValue={origin} label="Origin" name="origin" rules={[{required: true}]} style={{width: "120px"}}>
                <Select style={{width: "100px"}} onChange={origin => setOrigin(origin)}>
                    <Select.Option value="local">local</Select.Option>
                    <Select.Option value="remote">remote</Select.Option>
                </Select>
            </Form.Item>

            {origin === "local" ? (
                <Space.Compact>
                    <Form.Item
                        name="service"
                        rules={[{required: true, message: "For local files Service needs to be specified"}]}
                        style={{width: "210px"}}
                        label={
                            <>
                                Service &nbsp;
                                <Tooltip placement={"left"} overlayStyle={{maxWidth: "300px"}} title={"Name of the service withing the platform environment"}>
                                    <InfoCircleOutlined />
                                </Tooltip>
                            </>
                        }
                    >
                        <Input type="text" placeholder="eg. games/my-provider" style={{width: "190px"}} />
                    </Form.Item>
                    <Form.Item
                        name="path"
                        rules={[{required: true, message: "File path is required"}]}
                        style={{width: "520px"}}
                        label={
                            <>
                                Path &nbsp;
                                <Tooltip placement={"left"} overlayStyle={{maxWidth: "300px"}} title={"Local file path is relative to the /usr/src/ directory within the container's file system"}>
                                    <InfoCircleOutlined />
                                </Tooltip>
                            </>
                        }
                    >
                        <Input type="text" placeholder="eg. my-game/math/calculator.ts" style={{width: "520px"}} />
                    </Form.Item>
                </Space.Compact>
            ) : (
                <Space.Compact>
                    <Form.Item name="path" rules={[{required: true, message: "File url is required"}]} style={{width: "560px"}} label="URL">
                        <Input type="text" placeholder="eg. https://cdn.my.company/connector.js" style={{width: "540px"}} />
                    </Form.Item>
                </Space.Compact>
            )}

            <Divider>Audit</Divider>

            <Form.Item
                name="declaredChecksum"
                rules={[{message: "Certified checksum needs to be declared"}]}
                label={
                    <>
                        Checksum &nbsp;
                        <Tooltip placement={"left"} overlayStyle={{maxWidth: "300px"}} title={"The checksum approved by the certification authority"}>
                            <InfoCircleOutlined />
                        </Tooltip>
                    </>
                }
            >
                <Input type="text" placeholder="eg. a45243a28579cda3cbe0d95b6744044a34f2124a689bb95864559fe427f79ea3" />
            </Form.Item>

            <Form.Item label="Jurisdictions" name="jurisdictions">
                <Select mode={"tags"} open={false} tokenSeparators={[" ", ","]} placeholder="eg. uk, pt" />
            </Form.Item>

            <Form.Item initialValue={false} label="Block on Error" name="blockOnError" rules={[{required: true, message: "Please select"}]} style={{width: "120px"}}>
                <Select style={{width: "100px"}}>
                    <Select.Option value={true} key={"true"}>
                        Yes
                    </Select.Option>
                    <Select.Option value={false} key={"false"}>
                        No
                    </Select.Option>
                </Select>
            </Form.Item>

            <Form.Item label="Comment" name="comment">
                <Input type="text" placeholder="eg. GLI-19 critical files classification" />
            </Form.Item>
        </>
    );
};

const CriticalFiles = () => {
    const [state] = useAppState();

    const fetcher = useGraphQlFetcher();

    const columns: any[] = [
        {title: "Name", dataIndex: "name", sorter: true, ...tableFilter("LIKE")},
        {title: "Component", dataIndex: "component", sorter: true, ...tableFilter("LIKE")},
        {title: "Origin", dataIndex: "origin", sorter: true, ...tableFilter("LIKE")},
        {title: "Service", dataIndex: "service", sorter: true, ...tableFilter("LIKE")},
        {title: "File Path", dataIndex: "path", sorter: true, ...tableFilter("LIKE")},
        {title: "Checksum", dataIndex: "declaredChecksum", sorter: true, ...tableFilter("LIKE"), render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Jurisdictions", dataIndex: "jurisdictions", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Block on Error", dataIndex: "blockOnError", render: (value: boolean) => <StatusTag status={value.toString()} />},
        {title: "Comment", dataIndex: "comment", sorter: true, ...tableFilter("LIKE")},
        {title: "Id", dataIndex: "id", hidden: true},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageCriticalFiles") && (
                        <Button
                            size={"middle"}
                            onClick={() =>
                                Modal.confirm({
                                    title: "Verify critical file",
                                    content: "Are you sure you want to recalculate current checksum on this Critical File?",
                                    onOk: () => {
                                        return new Promise((resolve, reject) => {
                                            fetcher([
                                                gql`
                                                    mutation ($id: ID!) {
                                                        verifyCriticalFile(id: $id)
                                                    }
                                                `,
                                                {id: data.id},
                                            ])
                                                .then(() => {
                                                    message.success("File verified");
                                                    (dataTable?.current as any)?.revalidate();
                                                    resolve(false);
                                                })
                                                .catch((error: Error) => {
                                                    reject(error);
                                                });
                                        });
                                    },
                                })
                            }
                        >
                            Verify
                        </Button>
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageCriticalFiles") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content data={withRemovedEmptyArrays(data)} />}
                            data={withRemovedEmptyArrays(data)}
                            request={(fetcher, editedData) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: CriticalFileInput!) {
                                            editCriticalFile(id: $id, data: $data)
                                        }
                                    `,
                                    {id: data.id, data: withNullifiedEmptyArrays(editedData)},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageCriticalFiles") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteCriticalFile(id: $id)
                                        }
                                    `,
                                    {id: data.id},
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
            <Form layout={"inline"} style={{marginBottom: 20}}>
                <Form.Item>
                    <Button type={"primary"} htmlType="submit" icon={<PlayCircleOutlined />} onClick={refresh}>
                        Refresh
                    </Button>
                </Form.Item>

                {state?.account?.permissions?.includes("manageCriticalFiles") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: CriticalFileInput!) {
                                            addCriticalFile(data: $data)
                                        }
                                    `,
                                    {data: withNullifiedEmptyArrays(data)},
                                ])
                            }
                        />
                    </Form.Item>
                )}

                <Form.Item>
                    {state?.account?.permissions?.includes("manageCriticalFiles") && (
                        <Button
                            size={"middle"}
                            onClick={() =>
                                Modal.confirm({
                                    title: "Verify critical files",
                                    content: "Are you sure you want to recalculate checksums on all Critical Files?",
                                    onOk: () => {
                                        return new Promise((resolve, reject) => {
                                            fetcher([
                                                gql`
                                                    mutation {
                                                        verifyCriticalFiles
                                                    }
                                                `,
                                                {},
                                            ])
                                                .then(() => {
                                                    message.success("Files verified");
                                                    resolve(false);
                                                })
                                                .catch((error: Error) => {
                                                    reject(error);
                                                });
                                        });
                                    },
                                })
                            }
                        >
                            Verify Files
                        </Button>
                    )}
                </Form.Item>

                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>

                {state?.account?.permissions?.includes("manageCriticalFiles") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importCriticalFiles"} />
                    </Form.Item>
                )}
            </Form>

            <DataTable ref={dataTable} queryName={"criticalFiles"} columns={columns} sort={{field: "name", order: "DESC"}} />
        </>
    );
};

export default CriticalFiles;

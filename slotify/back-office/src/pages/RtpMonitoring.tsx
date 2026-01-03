import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Divider, Form, Input, Space, Tag, Tooltip} from "antd";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {InfoCircleOutlined, PlayCircleOutlined} from "@ant-design/icons";
import {ImportButton, ExportButton} from "../components/Buttons";

const Content = ({edit}: any) => {
    return (
        <>
            <Divider>Identification</Divider>

            <Space.Compact>
                <Form.Item label="Game" name="game" rules={[{required: true, message: "Game name is required"}]} style={{width: "250px"}}>
                    <Input type="text" placeholder="eg. my-game" style={{width: "230px"}} disabled={edit} />
                </Form.Item>

                <Form.Item label="Variant" name="variant" style={{width: "250px"}}>
                    <Input type="text" placeholder="eg. rtp96" style={{width: "230px"}} disabled={edit} />
                </Form.Item>
            </Space.Compact>

            <Divider>Statistics</Divider>

            <Form.Item
                name="declaredRtp"
                initialValue={0.96}
                rules={[{required: true, message: "Declared RTP is required"}]}
                label={
                    <>
                        Declared RTP &nbsp;
                        <Tooltip placement={"left"} overlayStyle={{maxWidth: "250px"}} title={"Value should be a number from 0 to 1, monitoring will be comparing actual RTP against this value."}>
                            <InfoCircleOutlined />
                        </Tooltip>
                    </>
                }
            >
                <Input type="number" step={0.01} style={{width: "230px"}} />
            </Form.Item>
        </>
    );
};

const RtpMonitoring = () => {
    const [state] = useAppState();

    const precisionMapper = (value: number) => (value ? Number(value.toFixed(4)) : value);
    const isMatch = (data: any) => data.declaredRtp < data.sampleRtp + data.sampleMarginOfError && data.declaredRtp > data.sampleRtp - data.sampleMarginOfError;

    const columns: any[] = [
        {title: "Created At", dataIndex: "createdAt", sorter: true, render: (createdAt: number) => new Date(createdAt).toLocaleString(), ...tableFilter("TIME")},
        {title: "Updated At", dataIndex: "updatedAt", sorter: true, render: (createdAt: number) => new Date(createdAt).toLocaleString(), ...tableFilter("TIME")},
        {title: "Id", dataIndex: "id", hidden: true},
        {title: "Game", dataIndex: "game", sorter: true, ...tableFilter("LIKE")},
        {title: "Variant", dataIndex: "variant", sorter: true, ...tableFilter("LIKE")},
        {title: "Declared RTP", dataIndex: "declaredRtp", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{precisionMapper(value)}</span>},
        {title: "RTP Match", sorter: false, render: (value: any, data: any) => <Tag color={isMatch(data) ? "green" : "red"}>{isMatch(data) ? "yes" : "no"}</Tag>},
        {
            title: (
                <>
                    Confidence Interval{" "}
                    <Tooltip
                        placement={"left"}
                        overlayStyle={{maxWidth: "500px"}}
                        title={"This represents 99.9% confidence interval of the Normalised Wagers (wins/bets) mean: 1 in 1000 experiments of the given size will still give a false-positive result."}
                    >
                        <InfoCircleOutlined />
                    </Tooltip>
                </>
            ),
            dataIndex: "sampleRtp",
            sorter: true,
            render: (value: any, data: any) => (
                <span style={{fontFamily: "monospace"}}>
                    <b>{precisionMapper(value)}</b> ± {precisionMapper(data.sampleMarginOfError)}
                </span>
            ),
        },
        {title: "Variance", dataIndex: "sampleVariance", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{precisionMapper(value)}</span>},
        {title: "Count", dataIndex: "sampleCount", sorter: true, render: (value: any) => <span style={{fontFamily: "monospace"}}>{value}</span>},
        {title: "Margin of Error", dataIndex: "sampleMarginOfError", hidden: true},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageRtpMonitoring") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content edit={true} />}
                            data={data}
                            request={(fetcher, editedData) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: RtpMonitoringInput!) {
                                            editRtpMonitoring(id: $id, data: $data)
                                        }
                                    `,
                                    {id: data.id, data: {...editedData, declaredRtp: parseFloat(editedData.declaredRtp)}},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageRtpMonitoring") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteRtpMonitoring(id: $id)
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

                {state?.account?.permissions?.includes("manageRtpMonitoring") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: RtpMonitoringInput!) {
                                            addRtpMonitoring(data: $data)
                                        }
                                    `,
                                    {data: {...data, declaredRtp: parseFloat(data.declaredRtp)}},
                                ])
                            }
                        />
                    </Form.Item>
                )}

                <Form.Item>
                    <ExportButton dataTable={dataTable} />
                </Form.Item>

                {state?.account?.permissions?.includes("manageRtpMonitoring") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importRtpMonitorings"} />
                    </Form.Item>
                )}
            </Form>

            <DataTable ref={dataTable} queryName={"rtpMonitoring"} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};

export default RtpMonitoring;

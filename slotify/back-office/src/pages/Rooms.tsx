import React, {FC, useRef, useState} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Divider, Form, Input, Modal, Select, Tooltip} from "antd";
import {InfoCircleOutlined, PlayCircleOutlined} from "@ant-design/icons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {AddButton, DeleteButton, EditButton, ExportButton, ImportButton} from "../components/Buttons";
import SelectAutoComplete from "../components/SelectAutoComplete";
import TagList from "../components/TagList";
import TextArea from "antd/es/input/TextArea";
import JsonView from "react18-json-view";
import StatusTag from "../components/StatusTag";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";

function removeProvablyFairData(data: any) {
    const {useProvablyFair, chainLength, ...rest} = data;
    return rest;
}

const Content: FC<{provablyFair?: {chainLength: number; lastHash: string; seed: string}; edit: boolean}> = ({provablyFair, edit}) => {
    const [useProvablyFair, setUseProvablyFair] = useState<boolean>(!!provablyFair);

    return (
        <>
            <Form.Item label="Status" name="enabled" rules={[{required: true, message: "Please select"}]} style={{width: "120px"}}>
                <Select style={{width: "100px"}} placeholder="Select">
                    <Select.Option value={true} key={"enabled"}>
                        Enabled
                    </Select.Option>
                    <Select.Option value={false} key={"disabled"}>
                        Disabled
                    </Select.Option>
                </Select>
            </Form.Item>

            <Form.Item label="Name" name="name" rules={[{required: true, type: "string"}]}>
                <Input type={"text"} placeholder={"Name"} />
            </Form.Item>
            <Form.Item label="Variant" name="variant" rules={[{type: "string"}]}>
                <Input type={"text"} placeholder={"Variant"} />
            </Form.Item>
            <Form.Item
                label="Provider"
                name="provider"
                rules={[
                    {required: true, type: "string"},
                    {pattern: /^\S+$/, message: "Spaces are not allowed"},
                ]}
            >
                <SelectAutoComplete type={"providers"} mode={"single"} disabled={edit} />
            </Form.Item>
            <Form.Item
                label="Game"
                name="game"
                rules={[
                    {required: true, type: "string"},
                    {pattern: /^\S+$/, message: "Spaces are not allowed"},
                ]}
            >
                <SelectAutoComplete type={"games"} mode={"single"} disabled={edit} />
            </Form.Item>

            <Form.Item
                label="Config"
                name="config"
                rules={[
                    {
                        required: true,
                        type: "string",
                        validator: (rule, value) => {
                            return new Promise((resolve, reject) => {
                                try {
                                    JSON.parse(value);
                                    resolve(null);
                                } catch {
                                    reject("Incorrect JSON format");
                                }
                            });
                        },
                    },
                ]}
            >
                <TextArea style={{height: 100, fontFamily: "monospace"}} />
            </Form.Item>

            <Form.Item label="Min bet" name="minBet">
                <Input type="number" placeholder="minBet" />
            </Form.Item>

            <Form.Item label="Max bet" name="maxBet">
                <Input type="number" placeholder="maxBet" />
            </Form.Item>

            <Divider>Availibility</Divider>

            <Form.Item label="Currencies" name="currencies">
                <SelectAutoComplete type={"currencies"} mode={"multiple"} />
            </Form.Item>
            <Form.Item label="Wallets" name="wallets">
                <SelectAutoComplete type={"wallets"} mode={"tags"} />
            </Form.Item>
            <Form.Item label="Operators" name="operators">
                <SelectAutoComplete type={"operators"} mode={"tags"} />
            </Form.Item>
            <Form.Item label="Brands" name="brands">
                <SelectAutoComplete type={"brands"} mode={"tags"} />
            </Form.Item>

            <Divider>Provably Fair</Divider>
            <Form.Item
                label={
                    <>
                        Use Provably Fair RNG &nbsp;
                        <Tooltip placement={"left"} overlayStyle={{maxWidth: "400px"}} title={"Provable fairness requires Hash Chain generation and then setting players' Seed (it will be enabled on Edit)"}>
                            <InfoCircleOutlined />
                        </Tooltip>
                    </>
                }
                initialValue={useProvablyFair}
                name={"useProvablyFair"}
                style={{width: "220px"}}
            >
                <Select value={useProvablyFair} disabled={edit} onChange={value => setUseProvablyFair(value)}>
                    <Select.Option value={true}>Yes</Select.Option>
                    <Select.Option value={false}>No</Select.Option>
                </Select>
            </Form.Item>

            <Form.Item initialValue={1000000} name={"chainLength"} label={`Chain Length`} rules={[{required: useProvablyFair}]}>
                <Input type="number" step={1} min={1} disabled={!useProvablyFair || edit} style={{width: 120, marginRight: 20}} />
            </Form.Item>

            <Divider orientation="left">Systems Communication</Divider>

            <Form.Item
                label={
                    <>
                        Secret Key &nbsp;{" "}
                        <Tooltip placement={"left"} overlayStyle={{maxWidth: "400px"}} title={"Secret key used to authenticate incoming systems websocket connections with this Room (empty prevents any system connections)"}>
                            <InfoCircleOutlined />
                        </Tooltip>
                    </>
                }
                name="secretKey"
            >
                <Input type="string" placeholder="secretKey" />
            </Form.Item>
        </>
    );
};

const SetSeedsButton: FC<{roomId: string; onSuccess: () => void}> = ({roomId, onSuccess}) => {
    const seedRef = useRef<string>("");
    const fetcher = useGraphQlFetcher();

    const handleSetSeed = async () =>
        await fetcher([
            gql`
                query ($roomId: ID!) {
                    lastRngHash(roomId: $roomId)
                }
            `,
            {roomId},
        ]).then(({lastRngHash}) =>
            Modal.confirm({
                title: "Set Player's Seed",
                width: "650px",
                content: (
                    <>
                        <p>
                            Last hash &nbsp;
                            <Tooltip
                                placement={"left"}
                                overlayStyle={{maxWidth: "500px"}}
                                title={
                                    "This is the last Hash of the generated Chain. " +
                                    "It won't be used for RNG generation and can be safely published to the community of players. " +
                                    "Publishing this Hash proves casinos commitment to the Hashes that will be used during the Provably Fair gameplay."
                                }
                            >
                                <InfoCircleOutlined />
                            </Tooltip>
                        </p>
                        <p style={{fontFamily: "monospace"}}>{lastRngHash}</p>
                        <p>Please set player's seed:</p>
                        <Input placeholder="Enter seed" onChange={e => (seedRef.current = e.target.value)} />
                    </>
                ),
                onOk: () =>
                    fetcher([
                        gql`
                            mutation ($roomId: ID!, $seed: String!) {
                                setRoomRngSeed(roomId: $roomId, seed: $seed)
                            }
                        `,
                        {roomId, seed: seedRef.current},
                    ]).then(onSuccess),
            }),
        );

    return (
        <Button size={"middle"} onClick={handleSetSeed}>
            Set Seed
        </Button>
    );
};

function removeEmptyArrays(room: any): any {
    if (!room.wallets || room.wallets.length === 0) delete room.wallets;
    if (!room.operators || room.operators.length === 0) delete room.operators;
    if (!room.brands || room.brands.length === 0) delete room.brands;
    if (!room.currencies || room.currencies.length === 0) delete room.currencies;
    return room;
}

function nullifyEmptyArrays(room: any): any {
    if (!room.wallets || room.wallets.length === 0) room.wallets = null;
    if (!room.operators || room.operators.length === 0) room.operators = null;
    if (!room.brands || room.brands.length === 0) room.brands = null;
    if (!room.currencies || room.currencies.length === 0) room.currencies = null;
    return room;
}

const Rooms = () => {
    const [state] = useAppState();

    const columns: any[] = [
        {title: "Room Id", dataIndex: "roomId", sorter: true, ...tableFilter("EQUAL"), hidden: true},
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: string) => new Date(createdAt).toLocaleString(), sorter: true, ...tableFilter("TIME")},
        {title: "Status", dataIndex: "enabled", sorter: true, render: (value: boolean) => <StatusTag status={value ? "enabled" : "disabled"} />},
        {title: "Name", dataIndex: "name", sorter: true, ...tableFilter("LIKE")},
        {title: "Variant", dataIndex: "variant", sorter: true, ...tableFilter("LIKE")},
        {title: "Provider", dataIndex: "provider", sorter: true, ...tableFilter("LIKE")},
        {title: "Game", dataIndex: "game", sorter: true, ...tableFilter("LIKE")},
        {title: "Min bet", dataIndex: "minBet", sorter: true},
        {title: "Max bet", dataIndex: "maxBet", sorter: true},
        {title: "Secret key", dataIndex: "secretKey", sorter: true, ...tableFilter("LIKE")},
        {title: "Currencies", dataIndex: "currencies", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Wallets", dataIndex: "wallets", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Operators", dataIndex: "operators", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Brands", dataIndex: "brands", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Config", dataIndex: "config", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Provably Fair", dataIndex: "provablyFair", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {
            title: "Actions",
            render: ({roomId, ...data}: any) => (
                <>
                    {state?.account?.permissions?.includes("manageRooms") && data.provablyFair && !data.provablyFair.seed && <SetSeedsButton roomId={roomId} onSuccess={refresh} />}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageRooms") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content provablyFair={data.provablyFair} edit={true} />}
                            data={{roomId, ...removeEmptyArrays(data), config: JSON.stringify(data.config, null, 2), ...data.provablyFair}}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($roomId: ID!, $data: RoomInput!) {
                                            editRoom(roomId: $roomId, data: $data)
                                        }
                                    `,
                                    {
                                        roomId,
                                        data: {
                                            ...nullifyEmptyArrays(removeProvablyFairData(data)),
                                            minBet: data.minBet ? parseFloat(data.minBet) : null,
                                            maxBet: data.maxBet ? parseFloat(data.maxBet) : null,
                                            config: JSON.parse(data.config),
                                        },
                                    },
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageRooms") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($roomId: ID!) {
                                            deleteRoom(roomId: $roomId)
                                        }
                                    `,
                                    {roomId},
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
                {state?.account?.permissions?.includes("manageRooms") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content edit={false} />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: RoomInput!) {
                                            addRoom(data: $data)
                                        }
                                    `,
                                    {
                                        data: {
                                            ...nullifyEmptyArrays(removeProvablyFairData(data)),
                                            minBet: data.minBet ? parseFloat(data.minBet) : null,
                                            maxBet: data.maxBet ? parseFloat(data.maxBet) : null,
                                            config: JSON.parse(data.config),
                                            provablyFair: data.useProvablyFair ? {chainLength: parseInt(data.chainLength)} : null,
                                        },
                                    },
                                ])
                            }
                        />
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
                {state?.account?.permissions?.includes("manageRooms") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importRooms"} />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"rooms"} columns={columns} sort={{field: "createdAt", order: "DESC"}} />
        </>
    );
};
export default Rooms;

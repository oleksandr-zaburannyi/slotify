import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Button, Divider, Form, Input, Select, Tooltip} from "antd";
import {InfoCircleOutlined, PlayCircleOutlined} from "@ant-design/icons";
import {AddButton, DeleteButton, EditButton, ExportButton, ImportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import SelectAutoComplete from "../components/SelectAutoComplete";
import TagList from "../components/TagList";
import TextArea from "antd/es/input/TextArea";
import JsonView from "react18-json-view";

const Content = ({user}: any) => {
    return (
        <>
            <Form.Item
                label="Game"
                name="game"
                rules={[
                    {required: true, type: "string"},
                    {pattern: /^\S+$/, message: "Spaces are not allowed"},
                ]}
            >
                <Input type="text" placeholder="game" />
            </Form.Item>
            <Form.Item label="Title" name="title">
                <Input type="text" placeholder="Title" />
            </Form.Item>
            <Form.Item label="Type" name="type">
                <Select placeholder="Type">
                    {["live", "lottery", "poker", "slot", "tableGame", "videoPoker", "other"].map(type => (
                        <Select.Option key={type}>{type}</Select.Option>
                    ))}
                </Select>
            </Form.Item>
            <Form.Item
                label="RGS config"
                name="rgsConfig"
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
            <Form.Item
                label="Inspection config"
                name="inspectionConfig"
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
            <Form.Item
                label="Provider"
                name="provider"
                rules={[
                    {required: true, type: "string"},
                    {pattern: /^\S+$/, message: "Spaces are not allowed"},
                ]}
            >
                <SelectAutoComplete type={"providers"} mode={"single"} />
            </Form.Item>
            <Form.Item
                label="RGS"
                name="rgs"
                rules={[
                    {required: true, type: "string"},
                    {pattern: /^\S+$/, message: "Spaces are not allowed"},
                ]}
            >
                <SelectAutoComplete type={"rgss"} mode={user.rgss ? "single-select" : "single"} />
            </Form.Item>
            <Form.Item
                label={
                    <>
                        RGS Game&nbsp;
                        <Tooltip title={"Optional game code for RGS if you want to overwrite game to avoid collisions"}>
                            <InfoCircleOutlined />
                        </Tooltip>
                    </>
                }
                name="rgsGame"
            >
                <Input type="rgsGame" placeholder="RGS Game" />
            </Form.Item>
            <Divider>Availibility</Divider>
            <Form.Item label="Wallets" name="wallets" rules={[{required: !!user.wallets}]}>
                <SelectAutoComplete type={"wallets"} mode={user.wallets ? "multiple" : "tags"} />
            </Form.Item>
            <Form.Item label="Operators" name="operators" rules={[{required: !!user.operators}]}>
                <SelectAutoComplete type={"operators"} mode={user.operators ? "multiple" : "tags"} />
            </Form.Item>
            <Form.Item label="Brands" name="brands" rules={[{required: !!user.brands}]}>
                <SelectAutoComplete type={"brands"} mode={user.brands ? "multiple" : "tags"} />
            </Form.Item>
        </>
    );
};

function removeEmptyArrays(game: any): any {
    if (!game.wallets || game.wallets.length === 0) delete game.wallets;
    if (!game.operators || game.operators.length === 0) delete game.operators;
    if (!game.brands || game.brands.length === 0) delete game.brands;
    return game;
}

function nullifyEmptyArrays(game: any): any {
    if (!game.wallets || game.wallets.length === 0) game.wallets = null;
    if (!game.operators || game.operators.length === 0) game.operators = null;
    if (!game.brands || game.brands.length === 0) game.brands = null;
    return game;
}

const Games = () => {
    const [state] = useAppState();

    const columns: any[] = [
        {title: "Game", dataIndex: "game", sorter: true, ...tableFilter("LIKE")},
        {title: "Title", dataIndex: "title", sorter: true, ...tableFilter("LIKE")},
        {title: "Type", dataIndex: "type", sorter: true, ...tableFilter("LIKE")},
        {title: "Provider", dataIndex: "provider", sorter: true, ...tableFilter("LIKE")},
        {title: "RGS", dataIndex: "rgs", sorter: true, ...tableFilter("LIKE")},
        {title: "RGS Game", dataIndex: "rgsGame", sorter: true, ...tableFilter("LIKE")},
        {title: "RGS config", dataIndex: "rgsConfig", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Inspection config", dataIndex: "inspectionConfig", render: (data: any) => <JsonView collapsed={true} enableClipboard={false} src={data} />},
        {title: "Wallets", dataIndex: "wallets", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Operators", dataIndex: "operators", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Brands", dataIndex: "brands", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {
            title: "Actions",
            render: ({game, ...data}: any) => (
                <>
                    {state?.account?.permissions?.includes("manageGames") && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content user={state.account} />}
                            data={{game, ...removeEmptyArrays(data), inspectionConfig: JSON.stringify(data.inspectionConfig, null, 2), rgsConfig: JSON.stringify(data.rgsConfig, null, 2)}}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($game: ID!, $data: GameInput!) {
                                            editGame(game: $game, data: $data)
                                        }
                                    `,
                                    {game, data: {...nullifyEmptyArrays(data), inspectionConfig: JSON.parse(data.inspectionConfig), rgsConfig: JSON.parse(data.rgsConfig)}},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageGames") && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($game: ID!) {
                                            deleteGame(game: $game)
                                        }
                                    `,
                                    {game},
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
                {state?.account?.permissions?.includes("manageGames") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content user={state.account} />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: GameInput!) {
                                            addGame(data: $data)
                                        }
                                    `,
                                    {data: {...nullifyEmptyArrays(data), inspectionConfig: JSON.parse(data.inspectionConfig), rgsConfig: JSON.parse(data.rgsConfig)}},
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
                {state?.account?.permissions?.includes("manageGames") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importGames"} />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"games"} columns={columns} sort={{field: "game", order: "ASC"}} />
        </>
    );
};
export default Games;

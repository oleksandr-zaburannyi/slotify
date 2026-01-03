import React, {useRef} from "react";
import {DataTable, tableFilter} from "../components/DataTable";
import {Alert, Button, Divider, Form, Input, Popover, Select} from "antd";
import {PlayCircleOutlined} from "@ant-design/icons";
import {ImportButton, ExportButton} from "../components/Buttons";
import {gql} from "graphql-request";
import {useAppState} from "../lib/AppProvider";
import {AddButton, DeleteButton, EditButton} from "../components/Buttons";
import {User} from "react-feather";
import {permissions} from "../lib/permissions";
import TagList from "../components/TagList";
import SelectAutoComplete from "../components/SelectAutoComplete";

const Content = ({user, edit, state}: any) => {
    return (
        <>
            {!edit && <Alert message="Password will be sent to provided email" type="info" showIcon style={{marginBottom: 20}} />}
            <input autoComplete="off" name="hidden" type="text" style={{display: "none"}} />
            <Form.Item label="E-mail" name="email" rules={[{type: "email", required: true, message: "Please input your e-mail!"}]}>
                <Input type="text" placeholder="E-mail" autoComplete={"off"} disabled={edit} prefix={<User size={16} strokeWidth={1} style={{color: "rgba(0,0,0,.25)"}} />} />
            </Form.Item>
            <Form.Item label="Comment" name="comment">
                <Input type="text" placeholder="Comment" />
            </Form.Item>
            <Divider>Permissions</Divider>
            <Form.Item name="permissions">
                <Select mode="multiple" style={{width: "100%"}} placeholder="Select permissions" optionLabelProp="name">
                    {permissions.map(item => (
                        <Select.Option value={item.name} label={item.name} key={item.name} disabled={!state?.account?.permissions?.includes(item.name)}>
                            <div className="demo-option-label-item">
                                <b>{item.name}</b> <i>({item.description})</i>
                            </div>
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>
            <Divider>Data access</Divider>
            <Form.Item label="RGS's" name="rgss" rules={[{required: !!user.rgss}]}>
                <SelectAutoComplete type={"rgss"} mode={user.rgss ? "multiple" : "tags"} />
            </Form.Item>
            <Form.Item label="Providers" name="providers" rules={[{required: !!user.providers}]}>
                <SelectAutoComplete type={"providers"} mode={user.providers ? "multiple" : "tags"} />
            </Form.Item>

            <Form.Item label="Wallets" name="wallets" rules={[{required: !!user.wallets}]}>
                <SelectAutoComplete type={"wallets"} mode={user.wallets ? "multiple" : "tags"} />
            </Form.Item>

            <Form.Item label="Operators" name="operators" rules={[{required: !!user.operators}]}>
                <SelectAutoComplete type={"operators"} mode={user.operators ? "multiple" : "tags"} />
            </Form.Item>

            <Form.Item label="Brands" name="brands" rules={[{required: !!user.brands}]}>
                <SelectAutoComplete type={"brands"} mode={user.brands ? "multiple" : "tags"} />
            </Form.Item>

            <Divider>Security</Divider>
            <Form.Item label="Whitelisted IPs" name="ips">
                <Select mode={"tags"} open={false} tokenSeparators={[" ", ","]}>
                    {user.ips?.map((value: string) => (
                        <Select.Option key={value} value={value}>
                            {value}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>
        </>
    );
};

function removeEmptyArrays(account: any): any {
    if (!account.permissions || account.permissions.length === 0) delete account.permissions;
    if (!account.rgss || account.rgss.length === 0) delete account.rgss;
    if (!account.providers || account.providers.length === 0) delete account.providers;
    if (!account.wallets || account.wallets.length === 0) delete account.wallets;
    if (!account.operators || account.operators.length === 0) delete account.operators;
    if (!account.brands || account.brands.length === 0) delete account.brands;
    if (!account.ips || account.ips.length === 0) delete account.ips;
    return account;
}

function nullifyEmptyArrays(account: any): any {
    if (!account.permissions || account.permissions.length === 0) account.permissions = null;
    if (!account.rgss || account.rgss.length === 0) account.rgss = null;
    if (!account.providers || account.providers.length === 0) account.providers = null;
    if (!account.wallets || account.wallets.length === 0) account.wallets = null;
    if (!account.operators || account.operators.length === 0) account.operators = null;
    if (!account.brands || account.brands.length === 0) account.brands = null;
    if (!account.ips || account.ips.length === 0) account.ips = null;
    return account;
}

function isSubAccount(account: any, subAccount: any): boolean {
    return !subAccount.permissions?.find((item: string) => !account.permissions?.includes(item));
}

const Accounts = () => {
    const [state] = useAppState();

    const columns: any[] = [
        {title: "E-mail", dataIndex: "email", sorter: true, ...tableFilter("LIKE")},
        {title: "Comment", dataIndex: "comment", sorter: true, ...tableFilter("LIKE")},
        {
            title: "Permissions",
            dataIndex: "permissions",
            ...tableFilter("LIKE"),
            render: (values: string[] = []) => (
                <Popover
                    transitionName=""
                    placement="right"
                    title="Permissions"
                    content={
                        <ul>
                            {values?.map(item => (
                                <li key={item}>
                                    <b>{item}</b> <i>({permissions.find(p => p.name === item)?.description})</i>
                                </li>
                            ))}
                        </ul>
                    }
                >
                    <span>{(values || []).length + " permissions"}</span>
                </Popover>
            ),
        },
        {title: "RGS's", dataIndex: "rgss", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Providers", dataIndex: "providers", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Wallets", dataIndex: "wallets", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Operators", dataIndex: "operators", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Brands", dataIndex: "brands", sorter: true, ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {title: "Last activity", dataIndex: "lastActivity", sorter: true, ...tableFilter("DATE"), render: (date: any) => (date ? new Date(date).toLocaleString() : "")},
        {title: "Whitelisted IPs", dataIndex: "ips", ...tableFilter("LIKE"), render: (values: string[], data: any, highlight: string) => <TagList tags={values} initialMaxTags={5} highlight={highlight} />},
        {
            title: "Actions",
            render: (data: any) => (
                <>
                    {state?.account?.permissions?.includes("manageAccounts") && state.account.email !== data.email && isSubAccount(state.account, data) && (
                        <EditButton
                            onSuccess={refresh}
                            content={<Content state={state} edit={true} user={removeEmptyArrays(state.account)} />}
                            data={removeEmptyArrays(data)}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!, $data: AccountInput!) {
                                            editAccount(id: $id, data: $data)
                                        }
                                    `,
                                    {data: nullifyEmptyArrays(data), id: data.email},
                                ])
                            }
                        />
                    )}
                    &nbsp;
                    {state?.account?.permissions?.includes("manageAccounts") && state.account.email !== data.email && isSubAccount(state.account, data) && (
                        <DeleteButton
                            onSuccess={refresh}
                            request={fetcher =>
                                fetcher([
                                    gql`
                                        mutation ($id: ID!) {
                                            deleteAccount(id: $id)
                                        }
                                    `,
                                    {id: data.email},
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
                {state?.account?.permissions?.includes("manageAccounts") && (
                    <Form.Item>
                        <AddButton
                            onSuccess={refresh}
                            content={<Content state={state} user={state.account} edit={false} />}
                            request={(fetcher, data) =>
                                fetcher([
                                    gql`
                                        mutation ($data: AccountInput!) {
                                            addAccount(data: $data)
                                        }
                                    `,
                                    {data: removeEmptyArrays(data)},
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
                {state?.account?.permissions?.includes("manageAccounts") && (
                    <Form.Item>
                        <ImportButton dataTable={dataTable} importMutation={"importAccounts"} />
                    </Form.Item>
                )}
            </Form>
            <DataTable ref={dataTable} queryName={"accounts"} columns={columns} />
        </>
    );
};
export default Accounts;

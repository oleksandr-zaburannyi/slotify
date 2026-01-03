import {Button, Form, message} from "antd";
import useGraphQlFetcher from "../../lib/useGraphQlFetcher";
import {PlusCircleOutlined} from "@ant-design/icons";
import React, {useEffect, useRef} from "react";
import {AppModal} from "../../App";
import {getForm} from "../../utils/getForm";
import {ThemeEditor} from "./ThemeEditor";
import {gql} from "graphql-request";

export interface ITheme {
    themeId?: string;
    name: string;
    campaignType: string;
    translations: Record<string, Record<string, string>>;
    icons: Record<string, string>;
}

export interface IAddThemeButton {
    onSuccess: () => void;
    edit?: boolean;
    theme?: ITheme;
}

const AddThemeButton = ({onSuccess, edit, theme}: IAddThemeButton) => {
    const [form] = Form.useForm();

    const fetcher = useGraphQlFetcher();

    const addFetcher = (data: ITheme) =>
        fetcher([
            gql`
                mutation ($data: ThemeInput!) {
                    addTheme(data: $data)
                }
            `,
            {data},
        ]);

    const editFetcher = (data: ITheme) =>
        fetcher([
            gql`
                mutation ($id: ID!, $data: ThemeInput!) {
                    editTheme(themeId: $id, data: $data)
                }
            `,
            {id: theme!.themeId, data},
        ]);

    const defaultThemesRef = useRef(null);
    useEffect(() => {
        fetcher([
            gql`
                query {
                    defaultThemes
                }
            `,
            {},
        ]).then(response => {
            defaultThemesRef.current = response.defaultThemes;
        });
    }, []);

    const handleOnClick = () =>
        AppModal().info({
            centered: true,
            width: 800,
            icon: null,
            title: "Add",
            okText: "Save",
            okCancel: true,
            content: getForm(form, <ThemeEditor defaultThemesRef={defaultThemesRef as any} form={form} edit={edit} theme={theme} />),
            onOk: () => {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(edit ? editFetcher : addFetcher)
                        .then(() => {
                            message.success(`Item ${edit ? "edited" : "added"} successfully`).then();
                            onSuccess && onSuccess();
                            resolve(false);
                        })
                        .catch(reject);
                });
            },
        });

    return edit ? (
        <Button type={"default"} htmlType="submit" onClick={handleOnClick} style={{marginRight: "5px"}}>
            Edit
        </Button>
    ) : (
        <Button type={"primary"} htmlType="submit" onClick={handleOnClick} icon={<PlusCircleOutlined />}>
            Add{" "}
        </Button>
    );
};

export default AddThemeButton;

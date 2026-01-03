import {Button, Form, message} from "antd";
import useGraphQlFetcher from "../../lib/useGraphQlFetcher";
import {PlusCircleOutlined} from "@ant-design/icons";
import React from "react";
import {AppModal} from "../../App";
import {IFetcher} from "../../utils/fetcher";
import {getForm} from "../../utils/getForm";

interface IAddButton {
    content: React.JSX.Element;
    onSuccess: () => void;
    request: (fetcher: IFetcher, data: any) => Promise<void>;
}

const AddButton = ({onSuccess, content, request}: IAddButton) => {
    const [form] = Form.useForm();
    const fetcher = useGraphQlFetcher();
    const handleOnClick = () =>
        AppModal().info({
            centered: true,
            width: 800,
            icon: null,
            title: "Add",
            okText: "Save",
            okCancel: true,
            content: getForm(form, content),
            onOk: () => {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(async value => {
                            request(fetcher, value)
                                .then(() => {
                                    message.success("Item added successfully");
                                    onSuccess && onSuccess();
                                    resolve(false);
                                })
                                .catch(reject);
                        })
                        .catch(reject);
                });
            },
        });

    return (
        <Button type={"primary"} htmlType="submit" onClick={handleOnClick} icon={<PlusCircleOutlined />}>
            Add
        </Button>
    );
};
export default AddButton;

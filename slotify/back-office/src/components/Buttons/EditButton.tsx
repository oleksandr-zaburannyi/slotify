import {Button, Form, message} from "antd";
import useGraphQlFetcher from "../../lib/useGraphQlFetcher";
import React from "react";
import {AppModal} from "../../App";
import {SizeType} from "antd/es/config-provider/SizeContext";
import {IFetcher} from "../../utils/fetcher";
import {getForm} from "../../utils/getForm";

interface IEditButton {
    content: React.JSX.Element;
    onSuccess: () => void;
    request: (fetcher: IFetcher, data: any) => Promise<void>;
    size?: SizeType;
    data: any;
}

const EditButton = ({onSuccess, content, request, data, size}: IEditButton) => {
    const [form] = Form.useForm();
    const fetcher = useGraphQlFetcher();
    const handleOnClick = () => {
        AppModal().info({
            centered: true,
            width: 800,
            icon: null,
            title: "Edit",
            okText: "Save",
            okCancel: true,
            content: getForm(form, content),
            onOk: async () => {
                return new Promise((resolve, reject) => {
                    form.validateFields()
                        .then(async value => {
                            request(fetcher, value)
                                .then(() => {
                                    message.success("Item edited successfully");
                                    onSuccess && onSuccess();
                                    resolve(false);
                                })
                                .catch(reject);
                        })
                        .catch(reject);
                });
            },
        });
        form.setFieldsValue(data);
    };
    return (
        <Button type={"default"} htmlType="submit" onClick={handleOnClick} size={size}>
            Edit
        </Button>
    );
};
export default EditButton;

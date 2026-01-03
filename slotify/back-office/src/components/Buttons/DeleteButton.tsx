import {Button, message, Modal} from "antd";
import useGraphQlFetcher from "../../lib/useGraphQlFetcher";
import React from "react";
import {IFetcher} from "../../utils/fetcher";

interface IDeleteButton {
    onSuccess: () => void;
    request: (fetcher: IFetcher) => Promise<void>;
}

const DeleteButton = ({onSuccess, request}: IDeleteButton) => {
    const fetcher = useGraphQlFetcher();
    const handleOnClick = () =>
        Modal.confirm({
            title: "Delete",
            content: "Are you sure you want to delete the item?",
            onOk: () => {
                return new Promise((resolve, reject) => {
                    request(fetcher)
                        .then(() => {
                            message.success("Item deleted successfully");
                            onSuccess && onSuccess();
                            resolve(false);
                        })
                        .catch(reject);
                });
            },
        });
    return (
        <Button type={"default"} htmlType="submit" onClick={handleOnClick} danger>
            Delete
        </Button>
    );
};
export default DeleteButton;

import {FormInstance} from "antd/lib/form";
import {Form} from "antd";

export const getForm = (form: FormInstance, content: React.JSX.Element) => {
    return (
        <div style={{maxHeight: "75vh", overflow: "auto"}}>
            <Form form={form} preserve={false} layout={"vertical"} style={{marginBottom: 20}}>
                {content}
            </Form>
        </div>
    );
};

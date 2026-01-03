import {Button, Checkbox, Input, message, Upload, UploadProps} from "antd";
import React from "react";
import {UploadOutlined} from "@ant-design/icons";
import {RcFile} from "antd/es/upload";

interface ThemeIconsProps {
    iconKeys: string[];
    customIcons: Record<string, string>;
    setCustomIcon: (iconKey: string, iconContent: string) => void;
    removeCustomIcon: (iconKey: string) => void;
}

const getBase64 = (file: RcFile): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

export const ThemeIcons = ({iconKeys, customIcons, setCustomIcon, removeCustomIcon}: ThemeIconsProps) => {
    return (
        <div>
            {iconKeys.map(iconKey => {
                const isOverridden = customIcons[iconKey] != null;

                const props: UploadProps = {
                    beforeUpload: async (file: RcFile) => {
                        const isPng = file.type === "image/png";
                        if (!isPng) {
                            message.error(`${file.name} is not a .png file`);
                        } else {
                            const base64String = await getBase64(file);
                            const imgHtml = `<img src="${base64String}" alt="${iconKey}" />`;
                            setCustomIcon(iconKey, imgHtml);
                        }
                        return false;
                    },
                    showUploadList: false,
                };

                return (
                    <div
                        key={iconKey}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            border: "1px solid #e0e0e0",
                            borderRadius: "5px",
                            padding: "10px",
                            marginBottom: "10px",
                        }}
                    >
                        <div style={{flex: 1, paddingRight: "20px"}}>
                            <div>{iconKey}</div>

                            {isOverridden && (
                                <>
                                    <div style={{marginTop: "10px", marginBottom: "10px"}}>
                                        <Input.TextArea value={customIcons[iconKey]} onChange={e => setCustomIcon(iconKey, e.target.value)} rows={4} placeholder="Enter your custom icon html here" />
                                    </div>

                                    <Upload {...props}>
                                        <Button icon={<UploadOutlined />}>Import PNG</Button>
                                    </Upload>
                                </>
                            )}
                        </div>

                        <Checkbox
                            checked={isOverridden}
                            onChange={e => {
                                const checked = e.target.checked;
                                if (checked) {
                                    setCustomIcon(iconKey, "");
                                } else {
                                    removeCustomIcon(iconKey);
                                }
                            }}
                        >
                            Custom
                        </Checkbox>
                    </div>
                );
            })}
        </div>
    );
};

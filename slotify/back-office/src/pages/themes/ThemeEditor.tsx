import React, {MutableRefObject, useEffect, useState} from "react";
import {Button, Divider, Form, Input, message, Modal, Select, Space, Tabs} from "antd";
import {campaignTypes} from "../promo/campaignTypes";
import {DeleteOutlined, PlusOutlined, SwapOutlined} from "@ant-design/icons";
import {ThemeTranslations} from "./ThemeTranslations";
import {FormInstance} from "antd/lib/form";
import {ITheme} from "./AddThemeButton";
import {ThemeIcons} from "./ThemeIcons";

type IDefaultThemes = Record<string, {translations: Record<string, Record<string, string>>; icons: string[]}>;

interface TranslationsProps {
    theme?: ITheme;
    form: FormInstance;
    defaultThemesRef: MutableRefObject<IDefaultThemes>;
    edit?: boolean;
}

export const ThemeEditor = ({theme, defaultThemesRef, form, edit}: TranslationsProps) => {
    const [campaignType, setCampaignType] = useState(theme?.campaignType);
    const [activeLanguage, setActiveLanguage] = useState(theme ? Object.keys(theme.translations)[0] : undefined);
    const [customTranslations, setCustomTranslations] = useState<Record<string, Record<string, string>>>(theme?.translations || {});
    const [customIcons, setCustomIcons] = useState<Record<string, string>>(theme?.icons || {});

    // Update form field dynamically whenever customTranslations changes
    useEffect(() => {
        form.resetFields(["translations", "icons"]);
        form.setFieldsValue({translations: customTranslations, icons: customIcons});
    }, [customTranslations, customIcons, form]);

    const addLanguage = (language: string) => {
        setCustomTranslations(previousTranslations => ({...previousTranslations, [language]: {}}));
    };

    const removeLanguage = (language: string) => {
        const {[language]: _, ...remainingTranslations} = customTranslations;
        setCustomTranslations(remainingTranslations);
    };

    const setCustomTranslation = (language: string, translationKey: string, translationContent: string) =>
        setCustomTranslations({
            ...customTranslations,
            [language]: {...customTranslations[language], [translationKey]: translationContent},
        });

    const removeCustomTranslation = (language: string, translationKey: string) => {
        const {[translationKey]: _, ...remainingTranslations} = customTranslations[language];
        setCustomTranslations({
            ...customTranslations,
            [language]: remainingTranslations,
        });
    };

    const setCustomIcon = (iconKey: string, iconContent: string) =>
        setCustomIcons({
            ...customIcons,
            [iconKey]: iconContent,
        });

    const removeCustomIcon = (iconKey: string) => {
        const {[iconKey]: _, ...remainingIcons} = customIcons;
        setCustomIcons(remainingIcons);
    };

    const handleOnClick = () => {
        if (campaignType == null) {
            message.warning("Please select campaign type first").then();
        }

        let newLanguageCode: string;
        return Modal.confirm({
            icon: <PlusOutlined />,
            title: "Add theme language",
            width: "280px",
            content: (
                <>
                    <Select style={{width: "180px"}} placeholder="language code" showSearch onChange={languageCode => (newLanguageCode = languageCode)}>
                        {Object.keys(defaultThemesRef.current[campaignType!].translations)
                            .filter(languageCode => !customTranslations[languageCode])
                            .map(languageCode => (
                                <Select.Option value={languageCode} key={languageCode}>
                                    {languageCode}
                                </Select.Option>
                            ))}
                    </Select>
                </>
            ),
            onOk: () => {
                if (newLanguageCode) {
                    addLanguage(newLanguageCode);
                    setActiveLanguage(newLanguageCode);
                } else {
                    message.warning("Please select valid language code").then();
                    return Promise.reject();
                }
            },
        });
    };

    return (
        <>
            <Space.Compact>
                <Form.Item initialValue={theme?.name} label="name" name="name" rules={[{required: true, message: "Please input unique theme name"}]} style={{width: "295px"}}>
                    <Input type="text" placeholder="my-event-theme" disabled={edit} />
                </Form.Item>
                <Form.Item initialValue={theme?.campaignType} label="Type" name="campaignType" rules={[{required: true}]} style={{width: "200px", marginLeft: 20}}>
                    <Select
                        style={{width: "180px"}}
                        placeholder="Select campaign type"
                        disabled={edit}
                        onChange={type => {
                            if (Object.keys(customTranslations).length > 0) {
                                Modal.confirm({
                                    icon: <SwapOutlined />,
                                    title: "Change campaign type",
                                    width: "380px",
                                    content: (
                                        <>
                                            <p>Do you want to switch campaign type?</p> <p>It will erase the current translations draft.</p>
                                        </>
                                    ),
                                    onOk: () => {
                                        setCustomTranslations({});
                                        setCampaignType(type);
                                    },
                                });
                            } else {
                                setCustomTranslations({});
                                setCampaignType(type);
                            }
                        }}
                    >
                        {Object.keys(defaultThemesRef.current).map(type => (
                            <Select.Option value={type} key={type}>
                                {campaignTypes[type].name}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </Space.Compact>

            {campaignType && (
                <>
                    <Divider>Translations</Divider>

                    <style>
                        {`
                   .ant-tabs-nav-more:hover .ant-tabs-dropdown {
                      display: none !important; /* Disable the hover behavior for the "..." button */
                    }
                    .ant-tabs-dropdown {
                      display: none !important; /* Optional: Prevent interaction with the dropdown menu */
                    }
                `}
                    </style>
                    <Tabs
                        activeKey={activeLanguage}
                        onChange={key => setActiveLanguage(key)}
                        tabPosition={"top"}
                        tabBarExtraContent={{
                            "left": (
                                <Button onClick={handleOnClick} style={{marginLeft: "5px", marginRight: "20px", marginBottom: "5px"}}>
                                    Add Language
                                </Button>
                            ),
                        }}
                        items={Object.keys(customTranslations).map(language => ({
                            label: (
                                <div style={{marginBottom: "5px"}}>
                                    {language}
                                    {activeLanguage === language && (
                                        <DeleteOutlined
                                            style={{
                                                marginLeft: "5px",
                                                marginBottom: "3px",
                                                marginRight: "0px",
                                                width: "10px",
                                                background: "none",
                                                cursor: "pointer",
                                                color: "#cd321b",
                                            }}
                                            onClick={e => {
                                                e.stopPropagation(); // Prevent activating the tab
                                                Modal.confirm({
                                                    icon: <DeleteOutlined />,
                                                    title: "Remove language",
                                                    width: "280px",
                                                    content: <span> Are you sure you want to remove language "{language}"</span>,
                                                    onOk: () => {
                                                        removeLanguage(language);
                                                    },
                                                });
                                            }}
                                        />
                                    )}
                                </div>
                            ),
                            key: language,
                            closable: false,
                            children: (
                                <ThemeTranslations
                                    customTranslations={customTranslations[language]}
                                    defaultTranslations={defaultThemesRef.current[campaignType!].translations[language]}
                                    setCustomTranslationEntry={(key: string, content: string) => setCustomTranslation(language, key, content)}
                                    removeCustomTranslationEntry={(key: string) => removeCustomTranslation(language, key)}
                                />
                            ),
                        }))}
                    />

                    <Form.Item name="translations" hidden>
                        <Input.TextArea readOnly />
                    </Form.Item>

                    <Divider>Icons</Divider>

                    <ThemeIcons iconKeys={defaultThemesRef.current[campaignType!].icons} customIcons={customIcons} setCustomIcon={setCustomIcon} removeCustomIcon={removeCustomIcon} />

                    <Form.Item name="icons" hidden>
                        <Input.TextArea readOnly />
                    </Form.Item>
                </>
            )}
        </>
    );
};

import React, {useState} from "react";
import {Button, Input, List, Modal, Select, Space, Tooltip} from "antd";
import {DeleteOutlined, PlusOutlined, TranslationOutlined} from "@ant-design/icons";

interface PrizeItemTranslationsProps {
    translations: Record<string, string>;
    onChange: (translations: Record<string, string>) => void;
    availableLanguages: string[];
    disabled?: boolean;
}

export const PrizeItemTranslations: React.FC<PrizeItemTranslationsProps> = ({translations, onChange, availableLanguages, disabled}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>();
    const [translationText, setTranslationText] = useState("");

    const usedLanguages = Object.keys(translations || {});
    const unusedLanguages = availableLanguages.filter(lang => !usedLanguages.includes(lang));
    const translationCount = usedLanguages.length;

    const handleAddTranslation = () => {
        if (selectedLanguage && translationText) {
            onChange({...translations, [selectedLanguage]: translationText});
            setSelectedLanguage(undefined);
            setTranslationText("");
        }
    };

    const handleRemoveTranslation = (language: string) => {
        const {[language]: _, ...remaining} = translations;
        onChange(remaining);
    };

    return (
        <>
            <Tooltip title={translationCount > 0 ? `${translationCount} translation(s)` : "Manage translations"}>
                <Button
                    type="dashed"
                    style={{width: 50, marginTop: 30, marginLeft: 10, marginRight: 10}}
                    icon={<TranslationOutlined style={{color: translationCount > 0 ? "#1890ff" : undefined}} />}
                    onClick={() => setIsModalOpen(true)}
                    disabled={disabled}
                />
            </Tooltip>

            <Modal
                title="Manage Item Translations"
                open={isModalOpen}
                onCancel={() => {
                    setIsModalOpen(false);
                    setSelectedLanguage(undefined);
                    setTranslationText("");
                }}
                footer={[
                    <Button key="close" onClick={() => setIsModalOpen(false)}>
                        Close
                    </Button>,
                ]}
                width={500}
            >
                {usedLanguages.length > 0 && (
                    <List
                        size="small"
                        dataSource={usedLanguages}
                        style={{marginBottom: 16}}
                        renderItem={lang => (
                            <List.Item actions={!disabled ? [<Button key="delete" type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveTranslation(lang)} />] : []}>
                                <List.Item.Meta title={lang} description={translations[lang]} />
                            </List.Item>
                        )}
                    />
                )}

                {!disabled && unusedLanguages.length > 0 && (
                    <Space.Compact style={{width: "100%"}}>
                        <Select style={{width: 120}} placeholder="Language" value={selectedLanguage} onChange={setSelectedLanguage} showSearch>
                            {unusedLanguages.map(lang => (
                                <Select.Option key={lang} value={lang}>
                                    {lang}
                                </Select.Option>
                            ))}
                        </Select>
                        <Input style={{flex: 1}} placeholder="Translated text" value={translationText} onChange={e => setTranslationText(e.target.value)} onPressEnter={handleAddTranslation} />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTranslation} disabled={!selectedLanguage || !translationText}>
                            Add
                        </Button>
                    </Space.Compact>
                )}

                {!disabled && unusedLanguages.length === 0 && usedLanguages.length > 0 && <div style={{color: "#888", textAlign: "center"}}>All available languages have translations</div>}

                {usedLanguages.length === 0 && <div style={{color: "#888", textAlign: "center", marginBottom: 16}}>No translations added yet</div>}
            </Modal>
        </>
    );
};

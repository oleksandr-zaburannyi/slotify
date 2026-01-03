import {Checkbox, Input} from "antd";
import React from "react";

interface ThemeTranslationsProps {
    defaultTranslations: Record<string, string>;
    customTranslations: Record<string, string>;
    setCustomTranslationEntry: (translationKey: string, translationContent: string) => void;
    removeCustomTranslationEntry: (translationKey: string) => void;
}

export const ThemeTranslations = ({defaultTranslations, customTranslations, setCustomTranslationEntry, removeCustomTranslationEntry}: ThemeTranslationsProps) => {
    return (
        <div>
            {Object.entries(defaultTranslations).map(([translationKey, defaultTranslationContent]) => {
                const isOverridden = customTranslations[translationKey] != null;

                return (
                    <div
                        key={translationKey}
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
                            <div>{defaultTranslationContent}</div>

                            {isOverridden && (
                                <div style={{marginTop: "10px"}}>
                                    <Input.TextArea value={customTranslations[translationKey]} onChange={e => setCustomTranslationEntry(translationKey, e.target.value)} rows={2} placeholder="Enter your custom theme here" />
                                </div>
                            )}
                        </div>

                        <Checkbox
                            checked={isOverridden}
                            onChange={e => {
                                const checked = e.target.checked;
                                if (checked) {
                                    setCustomTranslationEntry(translationKey, "");
                                } else {
                                    removeCustomTranslationEntry(translationKey);
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

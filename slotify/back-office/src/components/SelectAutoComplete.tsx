import {AutoComplete, Select, Tag} from "antd";
import React, {useEffect, useState} from "react";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {gql} from "graphql-request";
import Highlighter from "react-highlight-words";

type IType = "games" | "providers" | "rgss" | "wallets" | "operators" | "brands" | "jurisdictions" | "currencies";
type IResponse = Record<IType, string[]>;
let cache: Promise<IResponse>;

function createLabel(value: string, highlight: string) {
    return <Highlighter key={value + "_" + highlight} highlightStyle={{backgroundColor: "#ffc069", padding: 0}} searchWords={highlight ? [highlight] : []} autoEscape textToHighlight={"aaa" + value ? value.toString() : ""} />;
}

const tagRender = (props: any) => {
    const {value, closable, onClose} = props;
    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };
    return (
        <Tag onMouseDown={onPreventMouseDown} closable={closable} onClose={onClose}>
            {value}
        </Tag>
    );
};
const SelectAutoComplete: React.FC<{type: IType; mode: "single" | "multiple" | "tags" | "single-select"; value?: string[]; disabled?: boolean; onChange?: (e: any) => void}> = ({type, mode, disabled, value, onChange}) => {
    const fetcher = useGraphQlFetcher();
    const [options, setOptions] = useState<string[]>([]);
    const [filter, setFilter] = useState<string>("");

    const getData = async () => {
        if (cache) return cache;
        cache = fetcher([
            gql`
                query {
                    walletList
                    rgsList
                    gameList
                    providerList
                    operatorList
                    brandList
                    jurisdictionList
                    currencyList
                }
            `,
            {},
        ]).then(data => {
            return {
                wallets: data.walletList,
                rgss: data.rgsList,
                games: data.gameList,
                providers: data.providerList,
                operators: data.operatorList,
                brands: data.brandList,
                jurisdictions: data.jurisdictionList,
                currencies: data.currencyList,
            };
        });
        return cache;
    };
    useEffect(() => {
        getData().then(data => setOptions(data[type]));
    }, []);

    return mode === "single" ? (
        <AutoComplete
            options={options.filter(option => !filter || option.includes(filter)).map(value => ({value, label: createLabel(value, filter)}))}
            onChange={onChange}
            value={value}
            style={{minWidth: 180}}
            onSearch={(text: string) => setFilter(text)}
            disabled={disabled}
        />
    ) : (
        <Select
            optionLabelProp={"label"}
            options={options.map(value => ({value, label: createLabel(value, filter)}))}
            onSelect={() => setFilter("")}
            onDeselect={() => setFilter("")}
            tagRender={tagRender}
            onChange={onChange}
            onSearch={(text: string) => setFilter(text)}
            mode={mode === "single-select" ? undefined : mode}
            showSearch={mode === "single-select"}
            tokenSeparators={[" ", ","]}
            value={value}
            disabled={disabled}
        />
    );
};

export default SelectAutoComplete;

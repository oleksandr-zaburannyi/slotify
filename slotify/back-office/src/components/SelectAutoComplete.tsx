import {AutoComplete, Select, Tag} from "antd";
import React, {useEffect, useState} from "react";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {gql} from "graphql-request";
import Highlighter from "react-highlight-words";
import {countries, regions} from "./territories";

type IType = "games" | "providers" | "rgss" | "wallets" | "operators" | "brands" | "jurisdictions" | "currencies" | "countries" | "regions";
type IItem = {label: string; value: string};
type IResponse = Record<IType, IItem[]>;
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
    const [options, setOptions] = useState<IItem[]>([]);
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
                wallets: data.walletList.map((item: string) => ({value: item, label: item})),
                rgss: data.rgsList.map((item: string) => ({value: item, label: item})),
                games: data.gameList.map((item: string) => ({value: item, label: item})),
                providers: data.providerList.map((item: string) => ({value: item, label: item})),
                operators: data.operatorList.map((item: string) => ({value: item, label: item})),
                brands: data.brandList.map((item: string) => ({value: item, label: item})),
                jurisdictions: data.jurisdictionList.map((item: string) => ({value: item, label: item})),
                currencies: data.currencyList.map((item: string) => ({value: item, label: item})),
                countries: countries.map(item => ({value: item.code.toUpperCase(), label: `${item.name} (${item.code.toUpperCase()})`})),
                regions: regions.map(item => ({value: item.code, label: `${item.name}, ${countries.find(c => c.code.toUpperCase() === item.country)?.name} (${item.code})`})),
            };
        });
        return cache;
    };
    useEffect(() => {
        getData().then(data => setOptions(data[type]));
    }, []);

    return mode === "single" ? (
        <AutoComplete
            options={options.filter(option => !filter || (option.value + option.label).includes(filter)).map(item => ({value: item.value, label: createLabel(item.label, filter)}))}
            onChange={onChange}
            value={value}
            style={{minWidth: 180}}
            onSearch={(text: string) => setFilter(text)}
            disabled={disabled}
        />
    ) : (
        <Select
            optionLabelProp={"label"}
            options={options.map(item => ({value: item.value, label: createLabel(item.label, filter), searchLabel: item.label}))}
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
            filterOption={(input, option) => (option?.searchLabel ?? "").toString().toLowerCase().includes(input.toLowerCase())}
        />
    );
};

export default SelectAutoComplete;

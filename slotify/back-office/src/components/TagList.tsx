import {Button, Tag} from "antd";
import React, {useState} from "react";
import Highlighter from "react-highlight-words";

const TagList: React.FC<{tags: string[]; initialMaxTags?: number; highlight?: string}> = ({tags, initialMaxTags = 10, highlight}) => {
    const [maxTags, setMaxTags] = useState(initialMaxTags);
    const totalTags = tags?.length || 0;

    return (
        <>
            {tags?.slice(0, maxTags)?.map((value: string) => (
                <Tag key={value}>
                    <Highlighter highlightStyle={{backgroundColor: "#ffc069", padding: 0}} searchWords={highlight ? [highlight] : []} autoEscape textToHighlight={value ? value.toString() : ""} />
                </Tag>
            ))}
            {totalTags > maxTags && (
                <Button type="link" onClick={() => setMaxTags(totalTags)}>
                    Show {totalTags - maxTags} more »
                </Button>
            )}
            {maxTags > initialMaxTags && (
                <Button type="link" onClick={() => setMaxTags(initialMaxTags)}>
                    « Show {totalTags - initialMaxTags} less
                </Button>
            )}
        </>
    );
};

export default TagList;

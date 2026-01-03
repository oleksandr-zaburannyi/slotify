import {Spin, Tag, Tooltip} from "antd";
import React, {useEffect, useState} from "react";

const IpAddress = ({ip}: {ip?: string}) => {
    const [text, setText] = useState<any>(<Spin size={"small"} />);
    const [loaded, setLoaded] = useState(false);

    const onVisibleChange = (open: boolean) => {
        if (!open) return;
        if (loaded) return;
        fetch(`https://ipapi.co/${ip}/json/`)
            .then(res => res.json())
            .then(data => {
                setLoaded(true);
                if (data.error) {
                    setText(`Error: ${data.reason}`);
                } else {
                    setText(
                        <>
                            {data.city}, {data.country_name}
                            <br />
                            {data.org}
                        </>,
                    );
                }
            })
            .catch(() => {
                setText("IP details loading failed");
            });
    };
    useEffect(() => {
        setLoaded(false);
    }, [ip]);

    return ip ? (
        <Tooltip placement={"left"} title={text} onOpenChange={onVisibleChange}>
            <Tag>{ip}</Tag>
        </Tooltip>
    ) : (
        <></>
    );
};

export default IpAddress;

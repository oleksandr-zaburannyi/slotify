import React from "react";
import {Tag, Tooltip} from "antd";

const StatusTag = ({status, comment}: {status: string; comment?: string}) => {
    const colors: any = {
        started: "lightgrey",
        settled: "lightblue",
        finished: "green",
        unpaid: "red",
        failed: "red",
        cancel: "red",
        rejected: "red",
        cancelled: "orange",
        withdraw: "orange",
        deposit: "blue",
        true: "green",
        false: "red",
        disabled: "red",
        enabled: "green",
        passed: "green",
        alerted: "orange",
        blocked: "red",
        voided: "black",
    };
    return (
        <Tooltip placement="top" title={comment}>
            <Tag color={colors[status] || "lightblue"} key={status}>
                {status}
            </Tag>
        </Tooltip>
    );
};

export default StatusTag;

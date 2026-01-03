import React, {useState} from "react";
import {Button, Modal} from "antd";
import {DownloadOutlined} from "@ant-design/icons";
import {toCSV} from "@slotify/shared/lib/csv";

export function downloadCSV(content: string, filename: string = "report.csv") {
    const link = document.createElement("a");
    link.id = "download-csv";
    link.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content));
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
}

function getFirst(obj: any): any {
    for (const i in obj) {
        return obj[i];
    }
}

async function consolidateData(getData: (limit: any, offset: any) => Promise<void>) {
    const offset = 0;
    const limit = 100000;
    const data = getFirst(await getData(limit, offset));
    const csv = toCSV(data.items);
    if (data.meta.hasNext) {
        Modal.warning({content: `Downloaded only first ${data.items.length} rows. Please contact support team to get more information`, onOk: () => downloadCSV(csv)});
    } else {
        downloadCSV(csv);
    }
}

const ExportButton = ({dataTable}: any) => {
    const [loading, setLoading] = useState(false);
    return (
        <Button
            type={"dashed"}
            htmlType="submit"
            icon={<DownloadOutlined />}
            loading={loading}
            onClick={async () => {
                setLoading(true);
                consolidateData((dataTable.current as any).getData).finally(() => {
                    setLoading(false);
                });
            }}
        >
            Export
        </Button>
    );
};
export default ExportButton;

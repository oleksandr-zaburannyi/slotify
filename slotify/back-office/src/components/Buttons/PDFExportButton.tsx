import {Button} from "antd";
import {FilePdfOutlined} from "@ant-design/icons";
import React, {FC, RefObject} from "react";
import jsPDF from "jspdf";

const PDFExportButton: FC<{element: RefObject<HTMLDivElement | null>}> = ({element}) => {
    const exportPDF = () => {
        const doc = new jsPDF();
        const scale = doc.internal.pageSize.getWidth() / element.current!.clientWidth;
        doc.html(element.current!, {
            html2canvas: {
                height: element.current!.clientHeight,
                scale,
            },
            callback: doc => doc.save("verifier.pdf"),
        });
    };

    return (
        <Button icon={<FilePdfOutlined />} onClick={() => exportPDF()}>
            PDF
        </Button>
    );
};
export default PDFExportButton;

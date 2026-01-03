import type {ThemeConfig} from "antd";

const theme: ThemeConfig = {
    token: {
        colorPrimary: "#007bff",
        colorInfo: "#1890ff",
        colorSuccess: "#52c41a",
        colorWarning: "#faad14",
        colorError: "#f5222d",
        colorText: "rgba(0,0,0,0.75)",
        colorTextSecondary: "rgba(0,0,0,0.65)",
        colorSplit: "rgba(167, 141, 141, 0.05)",
        colorBgLayout: "#f7f7f9",
        colorFillTertiary: "#d9d9d9",
        colorPrimaryActive: "#1890ff",
        borderRadius: 4,
        borderRadiusSM: 4,
        fontFamily: `"Chinese Quote",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"`,
        fontFamilyCode: `"Anonymous Pro","SFMono-Regular",Consolas,"Liberation Mono",Menlo,Courier,monospace`,
    },
    components: {
        Layout: {
            headerBg: "#ffffff",
            headerHeight: 60,
        },
        Menu: {
            itemHeight: 36,
            darkItemBg: "rgb(51,51,51)",
            darkSubMenuItemBg: "rgb(51,51,51)",
            itemMarginBlock: 0,
        },
    },
};

export default theme;

import React from "react";
import {Code, DollarSign, FileText, Gift, Home, Settings as SettingsIcon, Shield, TrendingUp, Users} from "react-feather";
import Accounts from "../pages/Accounts";
import Round from "../pages/Round";
import GraphiQLViewer from "../components/GraphiQLViewer";
import GameWin from "../pages/GameWin";
import WalletVerifier from "../components/WalletVerifier";
import GameVerifier from "../components/GameVerifier";
import HomePage from "../pages/HomePage";
import Transactions from "../pages/Transactions";
import Players from "../pages/Players";
import CurrencyExchange from "../pages/CurrencyExchange";
import CurrencyAliases from "../pages/CurrencyAliases";
import RGSs from "../pages/RGSs";
import Wallets from "../pages/Wallets";
import FixedCurrencyRates from "../pages/FixedCurrencyRates";
import Settings from "../pages/Settings";
import AuditLogs from "../pages/AuditLogs";
import Campaigns from "../pages/Campaigns";
import Campaign from "../pages/Campaign";
import CriticalFiles from "../pages/CriticalFiles";
import CriticalFilesVerification from "../pages/CriticalFilesVerification";
import Games from "../pages/Games";
import Sessions from "../pages/Sessions";
import RtpMonitoring from "../pages/RtpMonitoring";
import CurrencyFeeds from "../pages/CurrencyFeeds";
import Rooms from "../pages/Rooms";
import Themes from "../pages/themes/Themes";
import ReportSender from "../pages/ReportSender";
import ReportExclusion from "../pages/ReportExclusion";

export interface IRoute {
    name: string;
    path?: string;
    content?: React.JSX.Element;
    visible?: boolean;
    icon?: React.JSX.Element;
    children?: any[];
}

const routes = (state: any): IRoute[] => [
    {path: "/", name: "Home", icon: <Home strokeWidth={2} size={16} />, content: <HomePage />, visible: false},
    {
        name: "Customer Service",
        icon: <Users strokeWidth={2} size={16} />,
        children: [
            {path: "/rounds/:id", name: "Rounds", content: <Round />, visible: false},
            {path: "/transactions", name: "Transactions", content: <Transactions />, visible: !!state?.account?.permissions?.includes("transactions") && !!state?.services?.includes("adapter")},
            {path: "/players", name: "Players", content: <Players />, visible: !!state?.account?.permissions?.includes("players") && !!state?.services?.includes("adapter")},
            {path: "/sessions", name: "Sessions", content: <Sessions />, visible: !!state?.account?.permissions?.includes("sessions") && !!state?.services?.includes("adapter")},
        ],
    },
    {
        name: "Promo",
        icon: <Gift strokeWidth={2} size={16} />,
        children: [
            {path: "/campaigns", name: "Campaigns", content: <Campaigns />, visible: !!state?.account?.permissions?.includes("campaigns") && !!state?.services?.includes("promo")},
            {path: "/campaigns/:id", name: "Campaigns", content: <Campaign />, visible: false},
            {path: "/themes", name: "Themes", content: <Themes />, visible: !!state?.account?.permissions?.includes("manageCampaigns") && !!state?.services?.includes("promo")},
            {path: "/themes/:id", name: "Themes", content: <Campaign />, visible: false},
        ],
    },
    {
        name: "Reports",
        icon: <FileText strokeWidth={2} size={16} />,
        children: [
            {path: "/game-win", name: "Game Win", content: <GameWin />, visible: !!state?.account?.permissions?.includes("gameWin") && !!state?.services?.includes("adapter")},
            {path: "/report-sender", name: "Report Sender", content: <ReportSender />, visible: !!state?.account?.permissions?.includes("reportSender") && !!state?.services?.includes("adapter")},
            {path: "/report-exclusions", name: "Report Exclusions", content: <ReportExclusion />, visible: !!state?.account?.permissions?.includes("reportExclusion") && !!state?.services?.includes("adapter")},
        ],
    },
    {
        name: "Tools & Jackpots",
        icon: <TrendingUp strokeWidth={2} size={16} />,
        children: [],
    },
    {
        name: "System",
        icon: <SettingsIcon strokeWidth={2} size={16} />,
        children: [
            {path: "/accounts", name: "Accounts", content: <Accounts />, visible: !!state?.account?.permissions?.includes("accounts") && !!state?.services?.includes("adapter")},
            {path: "/rgs", name: "RGS's", content: <RGSs />, visible: !!state?.account?.permissions?.includes("rgss") && !!state?.services?.includes("adapter")},
            {path: "/wallets", name: "Wallets", content: <Wallets />, visible: !!state?.account?.permissions?.includes("wallets") && !!state?.services?.includes("adapter")},
            {path: "/games", name: "Games", content: <Games />, visible: !!state?.account?.permissions?.includes("games") && !!state?.services?.includes("adapter")},
            {path: "/rooms", name: "Rooms", content: <Rooms />, visible: !!state?.account?.permissions?.includes("rooms") && !!state?.services?.includes("rgs")},
            {path: "/settings", name: "Settings", content: <Settings />, visible: !!state?.account?.permissions?.includes("settings") && !!state?.services?.includes("rgs")},
        ],
    },
    {
        name: "Currencies",
        icon: <DollarSign strokeWidth={2} size={16} />,
        children: [
            {path: "/currency-feeds", name: "Feeds", content: <CurrencyFeeds />, visible: !!state?.account?.permissions?.includes("manageCurrencies") && !!state?.services?.includes("adapter")},
            {path: "/currency-exchange-rates", name: "Exchange Rates", content: <CurrencyExchange />, visible: !!state?.account?.permissions?.includes("currencyExchange") && !!state?.services?.includes("adapter")},
            {path: "/currency-fixed-rates", name: "Fixed Rates", content: <FixedCurrencyRates />, visible: !!state?.account?.permissions?.includes("fixedCurrencyRates") && !!state?.services?.includes("rgs")},
            {path: "/currency-aliases", name: "Aliases", content: <CurrencyAliases />, visible: !!state?.account?.permissions?.includes("currencyAliases") && !!state?.services?.includes("adapter")},
        ],
    },
    {
        name: "Compliance",
        icon: <Shield strokeWidth={2} size={16} />,
        children: [
            {path: "/critical-files", name: "Critical Files", content: <CriticalFiles />, visible: !!state?.account?.permissions?.includes("criticalFiles") && !!state?.services?.includes("rgs")},
            {path: "/files-verification", name: "Checksums Verification", content: <CriticalFilesVerification />, visible: !!state?.account?.permissions?.includes("criticalFiles") && !!state?.services?.includes("rgs")},
            {path: "/rtp-monitoring", name: "RTP Monitoring", content: <RtpMonitoring />, visible: !!state?.account?.permissions?.includes("rtpMonitoring") && !!state?.services?.includes("rgs")},
        ],
    },
    {
        name: "APIs",
        icon: <Code strokeWidth={2} size={16} />,
        children: [
            {path: "/audit-logs", name: "Audit Logs", content: <AuditLogs />, visible: !!state?.account?.permissions?.includes("auditLogs") && !!state?.services?.includes("adapter")},
            {path: "/wallet-verifier", name: "Wallet Verifier", content: <WalletVerifier />, visible: !!state?.account?.permissions?.includes("verifier") && !!state?.services?.includes("adapter")},
            {path: "/game-verifier", name: "Game Verifier", content: <GameVerifier />, visible: !!state?.account?.permissions?.includes("verifier") && !!state?.services?.includes("rgs")},
            {path: "/graphiql", name: "GraphiQL", content: <GraphiQLViewer />, visible: !!state?.account?.permissions?.includes("graphiql")},
        ],
    },
];

export const availableRoutes = (state: any): IRoute[] =>
    routes(state)
        .map(item => ({...item, children: item.children && item.children.filter(child => child.visible !== false)}))
        .filter(item => item.visible !== false)
        .filter(item => !item.children || item.children.length > 0);

export const flatRoutes = (state: any): IRoute[] => {
    const flatRoutes: any = [];

    routes(state).forEach(item => {
        if (item.children) {
            flatRoutes.push(...item.children);
        } else {
            flatRoutes.push(item);
        }
    });
    return flatRoutes;
};

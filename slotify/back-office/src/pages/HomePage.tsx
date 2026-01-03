import React from "react";
import {Card, Col, Row} from "antd";
import {Briefcase, Layout, Youtube} from "react-feather";
import DailyGameWinChart from "../components/DailyGameWinChart";
import StatCard from "../components/StatCard";
import {theme} from "../components/styles/GlobalStyles";
import {useAppState} from "../lib/AppProvider";

const HomePage = () => {
    const [state] = useAppState();

    if (!state?.account?.permissions?.includes("gameWin")) return <></>;
    return (
        <>
            <Row gutter={16}>
                <Col xs={24} sm={12} md={8}>
                    <StatCard title="Operators" dimension={"operator"} icon={<Briefcase size={20} strokeWidth={1} />} color={theme.token!.colorPrimary!} />
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <StatCard title="Brands" dimension={"brand"} icon={<Layout size={20} strokeWidth={1} />} color={theme.token!.colorPrimary!} />
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <StatCard title="Games" dimension={"game"} icon={<Youtube size={20} strokeWidth={1} />} color={theme.token!.colorPrimary!} />
                </Col>
            </Row>

            <Card title="Daily Game Win" styles={{body: {padding: "1rem"}}} className="mb-4">
                <DailyGameWinChart />
            </Card>
        </>
    );
};

export default HomePage;

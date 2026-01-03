import React from "react";
import {useLocation} from "react-router-dom";
import {Layout} from "antd";
import {ThemeProvider} from "styled-components";
import Header from "./Header";
import SidebarMenu from "./SidebarMenu";
import {Container, Inner} from "./styles/Page";
import {theme} from "./styles/GlobalStyles";

const NonDashboardRoutes = ["/login", "/reset-password", "/change-password", "/error"];

const Page = ({children}: any) => {
    const location = useLocation();
    const isNotDashboard = NonDashboardRoutes.find(path => location.pathname.indexOf(path) === 0);

    return (
        <ThemeProvider theme={theme}>
            <Container>
                {!isNotDashboard && <Header />}
                <Layout className="workspace">
                    {!isNotDashboard && <SidebarMenu sidebarTheme={"light"} sidebarMode={"inline"} collapsed={false} />}
                    <Layout>
                        <Layout.Content>{!isNotDashboard ? <Inner>{children}</Inner> : children}</Layout.Content>
                    </Layout>
                </Layout>
            </Container>
        </ThemeProvider>
    );
};

export default Page;

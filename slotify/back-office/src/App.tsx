import React, {useState} from "react";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Page from "./components/Page";
import Login from "./pages/Login";
import {GlobalStyles, theme} from "./components/styles/GlobalStyles";
import AppProvider, {useAppState} from "./lib/AppProvider";
import {BrowserRouter, Navigate, Route, Routes} from "react-router-dom";
import {flatRoutes} from "./lib/routes";
import ChangePassword from "./pages/ChangePassword";
import {Modal, ConfigProvider} from "antd";
import {ModalStaticFunctions} from "antd/lib/modal/confirm";
import "react18-json-view/src/style.css";
import "antd/dist/reset.css";

function Pages() {
    const [state] = useAppState();
    const [routes] = useState(flatRoutes(state));

    const [redirectUrl] = useState(window.location.pathname.replace("/backoffice", "") + window.location.search);

    return (
        <BrowserRouter basename={"/backoffice"}>
            <Page>
                <Routes>
                    {routes.map((item: any) => (
                        <Route path={item.path} /*exact={!item.children}*/ key={item.path} element={state.account ? item.content : <Navigate state={{redirectUrl}} replace to={"/login"} />} />
                    ))}
                    <Route path="/login" element={state.account ? <Navigate replace to={"/"} /> : <Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/change-password/:key" element={<ChangePassword />} />
                    <Route path="/error" element={<NotFound code={404} />} />
                    <Route path="/*" element={<Navigate replace to={"/error"} />} />
                </Routes>
            </Page>
        </BrowserRouter>
    );
}

let _modal: Omit<ModalStaticFunctions, "warn">;

function App() {
    const [modal, contextHolder] = Modal.useModal();
    _modal = modal;
    return (
        <ConfigProvider theme={theme}>
            <AppProvider>
                <GlobalStyles />
                <Pages />
                <div>{contextHolder}</div>
            </AppProvider>
        </ConfigProvider>
    );
}

export const AppModal = () => _modal;
export default App;

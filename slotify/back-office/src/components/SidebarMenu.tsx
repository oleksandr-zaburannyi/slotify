import {Divider, Drawer, Layout, Menu, Tag} from "antd";
import {capitalize} from "../lib/helpers";
import React, {useState} from "react";
import DashHeader from "./styles/Header";
import Inner from "./styles/Sidebar";
import {availableRoutes} from "../lib/routes";
import {useAppState} from "../lib/AppProvider";
import {Link, useLocation} from "react-router-dom";
import {User} from "react-feather";
import Logo from "./Logo";
import env from "../lib/env";
import LogOutLink from "./styles/LogOutLink";

const SidebarContent = ({sidebarTheme, sidebarMode, collapsed}: any) => {
    const [state, dispatch] = useAppState();
    const [appRoutes] = useState(availableRoutes(state));
    const [openKeys, setOpenKeys] = useState(appRoutes.map(route => route.name));
    const {pathname} = useLocation();

    const onOpenChange = (openKeys: any) => {
        setOpenKeys([...openKeys, openKeys]);
    };

    const menu = (
        <>
            <Menu
                theme={sidebarTheme}
                className="border-0 scroll-y"
                style={{flex: 1, height: "100%"}}
                mode={sidebarMode}
                openKeys={openKeys}
                selectedKeys={[pathname]}
                onOpenChange={onOpenChange}
                items={appRoutes.map(route => {
                    const selected = route.path === "/" ? route.path === pathname : pathname.indexOf(route.path!) === 0 && route.path !== "/";
                    const hasChildren = !!route.children;

                    if (!hasChildren) {
                        return {
                            key: route.name,
                            label: route.name,
                            className: selected ? "ant-menu-item-selected" : "",
                            onClick: () => {
                                if (state.mobile) dispatch({type: "mobileDrawer"});
                            },
                            children: (
                                <Link to={route.path!}>
                                    <span className="anticon">{route.icon}</span>
                                    <span className="mr-auto" style={{fontWeight: "bold"}}>
                                        {capitalize(route.name)}
                                    </span>
                                </Link>
                            ),
                        };
                    }

                    const children = route.children!.map(subitem => ({
                        key: subitem.name,
                        className: pathname.indexOf(subitem.path) >= 0 ? "ant-menu-item-selected" : "",
                        onClick: () => {
                            if (state.mobile) dispatch({type: "mobileDrawer"});
                        },
                        label: (
                            <Link to={`${subitem.path ? subitem.path : ""}`}>
                                {" "}
                                <span className="mr-auto">{capitalize(subitem.name)}</span>{" "}
                            </Link>
                        ),
                    }));

                    return {
                        key: route.name,
                        label: (
                            <span>
                                <span className="anticon">{route.icon}</span> <span style={{fontWeight: "bold"}}>{capitalize(route.name)}</span>
                            </span>
                        ),
                        children,
                    };
                })}
            />
            {state.mobile && (
                <>
                    <Divider className={"m-0"} style={{display: `${sidebarTheme === "dark" ? "none" : ""}`}} />
                    <div className={`py-3 px-4 bg-${sidebarTheme}`}>
                        {state.account && (
                            <div style={{overflowWrap: "break-word"}}>
                                <span className="anticon">
                                    <User strokeWidth={1} size={16} />
                                </span>{" "}
                                <i>{state.account.email}</i>
                                &nbsp;&nbsp;
                                <LogOutLink />
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );

    return (
        <Inner>
            {!state.mobile && (
                <Layout.Sider width={240} className={`bg-${sidebarTheme}`} theme={sidebarTheme} collapsed={collapsed}>
                    <div style={{display: "flex", flexDirection: "column", height: "100%"}}>{menu}</div>
                </Layout.Sider>
            )}

            <Drawer closable={false} width={240} placement="left" onClose={() => dispatch({type: "mobileDrawer"})} open={state.mobileDrawer} className="chat-drawer">
                <Inner>
                    <div style={{overflow: "hidden", flex: "1 1 auto", flexDirection: "column", display: "flex", height: "100vh"}}>
                        <DashHeader>
                            <Layout.Header>
                                <Link to="/" className="brand">
                                    <Logo width={"40px"} />
                                    <strong className="mx-1 text-black">{env.VITE_NAME || "Back Office"}</strong>
                                    {env.VITE_ENV && <Tag>{env.VITE_ENV}</Tag>}
                                </Link>
                            </Layout.Header>
                        </DashHeader>
                        {menu}
                    </div>
                </Inner>
            </Drawer>
        </Inner>
    );
};

export default SidebarContent;

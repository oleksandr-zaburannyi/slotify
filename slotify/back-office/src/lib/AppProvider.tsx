import React, {createContext, useContext, useEffect, useReducer} from "react";
import cookie from "js-cookie";

const Context = createContext(null as any);
const {Provider} = Context;
let mql: MediaQueryList;

interface IState {
    name?: string;
    account?: any;
    services?: any;
    token?: string;
    mobile?: boolean;
    mobileDrawer?: boolean;
}

type IAction = {type: "loggedIn"; data: {token: string; account: any; services: string[]}} | {type: "loggedOut"} | {type: "mobile"} | {type: "mobileDrawer"};

const reducer = (state: IState, action: IAction): IState => {
    switch (action.type) {
        case "loggedIn":
            const {token, account, services} = action.data;
            cookie.set("token", token);
            cookie.set("services", JSON.stringify(services));
            cookie.set("account", JSON.stringify(account));
            return {...state, account, services, token};
        case "loggedOut":
            cookie.remove("token");
            cookie.remove("account");
            cookie.remove("services");
            return {...state, token: undefined, account: undefined, services: undefined};
        case "mobile":
            return {...state, mobile: !mql.matches};
        case "mobileDrawer":
            return {...state, mobileDrawer: !state.mobileDrawer};
        default:
            return state;
    }
};

const AppProvider = (props: {children: React.ReactNode}) => {
    const [state, dispatch] = useReducer(reducer, {
        name: "Back Office",
        mobile: false,
        token: cookie.get("token"),
        services: cookie.get("services") ? JSON.parse(cookie.get("services")!) : undefined,
        account: cookie.get("account") ? JSON.parse(cookie.get("account")!) : undefined,
        mobileDrawer: false,
    });

    useEffect(() => {
        mql = window.matchMedia(`(min-width: 992px)`);
        mql.addListener(mediaQueryChanged);
        dispatch({type: "mobile"});
        return () => mql.removeListener(mediaQueryChanged);
    }, []);

    const mediaQueryChanged = () => {
        dispatch({type: "mobile"});
    };

    return <Provider value={[state, dispatch]}>{props.children}</Provider>;
};

export default AppProvider;
export const useAppState = () => useContext(Context);

import {ThemeType} from "grommet/themes";
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, createRef} from "react";
import {Box, Button, Card, CardBody, CardFooter, CardHeader, Carousel, Drop, Grommet, Heading, Notification, RadioButtonGroup, Text, ThemeContext} from "grommet";
import {normalizeColor} from "grommet/utils";
import ReactDOM from "react-dom/client";
import {ICallbacks} from "./Connector";
import {Icon} from "grommet-icons/icons";
import {preventFocus} from "./util/preventFocus";
import {Alert} from "grommet-icons";
import tinycolor from "tinycolor2";
import Modal from "react-modal";

interface IPopup {
    title?: string;
    message?: any;
    options?: {
        label: string;
        value: number;
        data?: any;
    }[];
    buttons?: {
        label: string;
        primary?: boolean;
        secondary?: boolean;
        callback: (selectedOption?: {index: number; data: any}) => void | null | false | Promise<void | null | false>;
        preventClose?: boolean;
    }[];
}

export type PromoUIStyle = {
    x?: number;
    y?: number;
    alpha?: number;
    scale?: number;
};

type IHidePopUpData = {
    showNextPopup: boolean;
};

export interface UiApi {
    showPopup: (popup: IPopup) => void;

    hidePopup(data?: IHidePopUpData): void;

    showOverlay: () => void;
    hideOverlay: () => void;

    showReplay: (content: React.ReactNode) => void;
    hideReplay: () => void;

    setPromoUI: (promoUIS: PromoUIStyle) => void;

    addPromoHeader: (campaignType: string, icon: Icon, value: string, label: string, onClick?: () => any, alert?: React.ReactNode) => void;
    removePromoHeader: (campaignType: string) => void;

    setSessionHeader: (content: React.ReactNode) => void;

    getTheme: () => ThemeType;
}

export interface ITheme {
    fontFamily?: string;
    backgroundColor?: string;
    primaryColor?: string;
    secondaryColor?: string;
    primaryTextColor?: string;
    secondaryTextColor?: string;
    overlayBackgroundColor?: string;
}

export default function createUI(theme?: ITheme, callbacks?: ICallbacks): () => UiApi {
    const mergedTheme: ThemeType = {
        global: {
            font: {
                family: theme?.fontFamily || "Helvetica, Arial",
            },
            colors: {
                "background-front": theme?.backgroundColor || "#FFFFFF",
                "background-overlay": theme?.overlayBackgroundColor || "rgba(0, 0, 0, 0.5)",
                "background-back": theme?.secondaryColor || "#EDEDED",
                control: theme?.primaryColor || "#7D4CDB",
                focus: theme?.primaryColor || "#7D4CDB",
            },
        },
        radioButton: {
            border: {
                color: theme?.primaryColor || "#7D4CDB",
            },
            hover: {
                border: {
                    color: theme?.primaryColor || "#7D4CDB",
                },
            },
        },
        layer: {
            container: {
                extend: () => {
                    return {
                        "@media screen and (max-width: 768px)": {
                            width: "50%",
                        },
                        "@media screen and (max-width: 725px)": {
                            width: "55%",
                        },
                        "@media screen and (max-width: 600px)": {
                            width: "75%",
                        },
                        "@media screen and (max-width: 450px)": {
                            width: "90%",
                        },
                    };
                },
            },
        },
    };
    if (theme?.secondaryTextColor || theme?.primaryTextColor) {
        mergedTheme.global!.colors!.text = {dark: theme?.secondaryTextColor, light: theme?.primaryTextColor};
    }

    if (theme?.overlayBackgroundColor) {
        mergedTheme.layer!.overlay = {background: theme?.overlayBackgroundColor};
    }

    const ref = createRef<UiApi>();
    const container = document.createElement("div");
    container.id = "connector-ui";
    container.setAttribute("style", "position: absolute; width: 100%; top: 0;");
    document.body.appendChild(container);
    const app = <Ui theme={mergedTheme} callbacks={callbacks} ref={ref} />;
    const root = ReactDOM.createRoot(container!);
    Modal.setAppElement(container);
    root.render(app);
    return () => ref.current as UiApi;
}

interface IUi {
    theme: ThemeType;
    callbacks?: ICallbacks;
}

const noAnimation = {opacity: 1, transform: "scale(1)", animation: "none"};

const Ui = forwardRef<UiApi, IUi>(({theme, callbacks = {}}, ref) => {
    const rootRef = useRef<any>(null);
    const popups = useRef<IPopup[]>([]);
    const [popup, setPopup] = useState<IPopup | null>(null);
    const [radioOptionValue, setRadioOptionValue] = useState<number | undefined>();
    const [overlay, setOverlay] = useState<boolean>(false);
    const [replay, setReplay] = useState<React.ReactNode | null>(null);
    const [promoStyle, setPromoStyle] = useState<PromoUIStyle>({});
    const [promoHeaders, setPromoHeaders] = useState<Record<string, {icon: Icon; label: string; value: string; onClick?: () => any; alert: React.ReactNode}>>({});
    const [sessionHeader, setSessionHeader] = useState<React.ReactNode>();
    const [promoAlert, setPromoAlert] = useState<React.ReactNode>(null);
    const [bodyOverflowStyle, setBodyOverflowStyle] = useState("");
    const isModalOpen = popup && !replay;

    const hidePopup = useCallback(
        (data?: IHidePopUpData) => {
            callbacks.popupClosed && callbacks.popupClosed(popups.current.length - 1);
            popups.current.shift();

            if (data?.showNextPopup) {
                setPopup(popups.current[0]);
            }
        },
        [popups],
    );

    useEffect(() => {
        if (bodyOverflowStyle !== "hidden" && isModalOpen) {
            setBodyOverflowStyle(document.body.style.overflow);
            document.body.style.overflow = "hidden";
        }

        return () => {
            if (bodyOverflowStyle !== "hidden" && isModalOpen) {
                document.body.style.overflow = bodyOverflowStyle;
            }
        };
    }, [bodyOverflowStyle, isModalOpen]);

    useImperativeHandle(ref, () => ({
        showPopup: popup => {
            callbacks.popupOpened && callbacks.popupOpened(popups.current.length + 1);
            popups.current.unshift(popup);
            setPopup(popups.current[0]);

            // clear previous radio value in case of popup queue
            setRadioOptionValue(undefined);

            if (popups.current[0].options?.length === 1) {
                setRadioOptionValue(popups.current[0].options[0].value);
            }
        },
        hidePopup,
        showOverlay: () => setOverlay(true),
        hideOverlay: () => setOverlay(false),
        showReplay: (content: React.ReactNode) => setReplay(content),
        hideReplay: () => setReplay(null),
        setPromoUI: promoUIStyle => setPromoStyle(promoUIStyle),
        addPromoHeader: (campaignType, icon, value, label, onClick, alert) => {
            const newPromoHeaders = {...promoHeaders};
            newPromoHeaders[campaignType] = {icon, value, label, onClick, alert};
            setPromoHeaders(newPromoHeaders);
        },
        removePromoHeader: campaignType => setPromoHeaders((prevPromoHeaders) => Object.fromEntries(Object.entries(prevPromoHeaders).filter(([key]) => key !== campaignType))),
        setSessionHeader: (content: React.ReactNode) => setSessionHeader(content),
        getTheme: () => theme as ThemeType,
    }));

    return (
        <Grommet theme={theme} ref={rootRef} plain>
            {rootRef.current && sessionHeader && (
                <Drop align={{top: "top"}} elevation={"none"} target={rootRef.current} stretch={false}>
                    <Box background="background-back" style={{padding: "0px 6px 0px 6px", borderBottomLeftRadius: 6, borderBottomRightRadius: 6, alignItems: "center", ...noAnimation}}>
                        {sessionHeader}
                    </Box>
                </Drop>
            )}

            {rootRef.current && replay && (
                <Drop align={{top: "top"}} pad={"small"} background={"none"} target={rootRef.current} elevation={"none"} stretch={false} style={{...noAnimation}}>
                    {replay}
                </Drop>
            )}

            {rootRef.current && !replay && Object.entries(promoHeaders).length > 0 && (
                <>
                    {promoAlert && <Notification toast={true} icon={<></>} message={promoAlert} onClose={() => setPromoAlert(null)} time={3000} />}
                    <Drop
                        stretch={false}
                        round={"small"}
                        target={rootRef.current}
                        elevation={"small"}
                        style={{
                            animation: "none",
                            marginTop: promoStyle.y || 0,
                            marginLeft: promoStyle.x || 0,
                            transformOrigin: "top left",
                            transform: `scale(${promoStyle.scale || 1})`,
                            opacity: promoStyle.alpha || 1,
                            background: "none",
                        }}
                    >
                        <Box background="background-back" height={"50px"}>
                            <Carousel key={"carousel-" + Object.values(promoHeaders).length} play={Object.values(promoHeaders).length > 1 ? 5000 : 0} controls={false} className={"promoCarousel"}>
                                {Object.values(promoHeaders).map((promoHeader, i) => (
                                    <Button onClick={promoHeader.onClick} onFocus={preventFocus} key={"promoHeader" + i}>
                                        <Box margin={"0px 5px 0px 5px"} width={"140px"}>
                                            <Box direction="row" align="center" gap="0">
                                                {promoHeader.alert && (
                                                    <Alert
                                                        size={"38"}
                                                        color={"red"}
                                                        onClick={(e: React.MouseEvent) => {
                                                            e.stopPropagation();
                                                            setPromoAlert(promoHeader.alert);
                                                        }}
                                                    />
                                                )}
                                                {!promoHeader.alert && <promoHeader.icon size={"38"} color={"control"} />}
                                                <Box direction="column" align="center" gap={"none"} width={"105px"} height={"50px"}>
                                                    <Heading level={3} margin={"2px"}>
                                                        {promoHeader.value}
                                                    </Heading>
                                                    <Text size={"xsmall"} margin={"-6px"}>
                                                        {promoHeader.label}
                                                    </Text>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Button>
                                ))}
                            </Carousel>
                        </Box>
                    </Drop>
                </>
            )}

            {overlay && (
                <div
                    style={{
                        zIndex: 2147483647,
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "black",
                        opacity: 0.5,
                        backdropFilter: "blur(5px)",
                        pointerEvents: "all",
                    }}
                />
            )}
            {isModalOpen && (
                <ThemeContext.Consumer>
                    {contextTheme => {
                        const backgroundColor = tinycolor(normalizeColor("background-front", contextTheme));
                        const isBackgroundDark = backgroundColor.isDark();
                        const typedContextTheme = contextTheme as ThemeType;

                        return (
                            <Modal
                                isOpen={isModalOpen}
                                style={{
                                    overlay: {
                                        background: normalizeColor("background-overlay", contextTheme),
                                        position: "fixed",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                    },
                                    content: {
                                        position: "absolute",
                                        overflow: "auto",
                                        display: "flex",
                                        maxHeight: "100%",
                                        minHeight: "48px",
                                        maxWidth: "100%",
                                        background: normalizeColor("background-front", contextTheme),
                                        color: normalizeColor("text", contextTheme, isBackgroundDark),
                                        top: "50%",
                                        left: "50%",
                                        right: "auto",
                                        bottom: "auto",
                                        marginRight: "-50%",
                                        transform: "translate(-50%, -50%)",
                                        padding: 0,
                                        borderWidth: 0,
                                        fontFamily: typedContextTheme.global?.font?.family || "Helvetica, Arial",
                                        fontSize: "18px",
                                        lineHeight: "24px",
                                        textSizeAdjust: "100%",
                                    },
                                }}
                            >
                                <Card>
                                    {popup.title && (
                                        <CardHeader pad="medium" justify="center">
                                            <Heading margin="none" level={3}>
                                                {popup.title}
                                            </Heading>
                                        </CardHeader>
                                    )}

                                    {(popup.message || popup.options) && (
                                        <CardBody pad="medium" justify="center" style={{textAlign: "center", width: "100%", padding: "24px 24px 12px 24px"}}>
                                            {popup.message && (typeof popup.message === "string" ? <div dangerouslySetInnerHTML={{__html: popup.message as any}} /> : popup.message)}
                                            {popup.options && (
                                                <RadioButtonGroup name="radio" style={{alignSelf: "center"}} options={popup.options} value={radioOptionValue} onChange={event => setRadioOptionValue(parseInt(event.target.value))} />
                                            )}
                                        </CardBody>
                                    )}

                                    <CardFooter pad="medium" justify="center" background="background-back">
                                        {popup.buttons?.map(button => (
                                            <Button
                                                key={button.label}
                                                label={button.label.toUpperCase()}
                                                secondary={button.secondary}
                                                primary={button.primary}
                                                onClick={() => {
                                                    if (button.preventClose !== true) {
                                                        hidePopup({showNextPopup: true});
                                                    }
                                                    const selectedOption = radioOptionValue !== undefined ? {index: radioOptionValue, data: popup.options?.[radioOptionValue]?.data} : undefined;
                                                    button.callback(selectedOption);
                                                }}
                                            />
                                        ))}
                                    </CardFooter>
                                </Card>
                            </Modal>
                        );
                    }}
                </ThemeContext.Consumer>
            )}
        </Grommet>
    );
});

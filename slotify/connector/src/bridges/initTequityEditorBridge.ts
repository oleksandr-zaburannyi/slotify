import {Connector} from "../Connector";

let rootElement: HTMLElement;
let sendToEditor: (type: string, data?: any) => void;

const resizeObserver = (elem: Element, callback: (entry: ResizeObserverEntry) => void) => {
    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            callback(entry);
        }
    });
    ro.observe(elem);

    return ro;
};

const initTequityEditorBridge = (connector: Connector) => {
    const {port1, port2} = new MessageChannel();
    const handleChannelMessage = (e: MessageEvent<string>) => {
        const {type, data} = JSON.parse(e.data);
        switch (type) {
            case "setCustomProps":
                document.body.style.cssText = data;
                break;
        }
    };

    port1.onmessage = handleChannelMessage;
    sendToEditor = (type: string, data?: any) => {
        port1.postMessage(
            JSON.stringify({
                type,
                ...(data ? {data} : undefined),
            }),
        );
    };

    rootElement = document.querySelector("#root")!;

    registerGameEvents(connector);

    resizeObserver(rootElement, entry => {
        sendToEditor("windowSize", {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
        });
    });

    window.parent.postMessage("initConnectorConnection", "*", [port2]);
};

function registerGameEvents(connector: Connector) {
    connector.emitter.on("balance", ({balance}) => sendToEditor("balance", {balance, balanceFormatted: connector.formatCurrency(balance)}));
    connector.emitter.on("wager", ({wager}) => sendToEditor("wager", wager));
    connector.emitter.on("gameLoaded", () => {
        sendToEditor("gameLoaded");
        setTimeout(() => {
            sendToEditor("windowSize", {
                width: rootElement.scrollWidth,
                height: rootElement.scrollHeight,
            });
        }, 0);
    });
}

export default initTequityEditorBridge;

import {create} from "./src";

export {};

type Connector = {
    create: typeof create;
};
declare global {
    interface Window {
        connector: Connector;
    }

    const connector: Connector;
}

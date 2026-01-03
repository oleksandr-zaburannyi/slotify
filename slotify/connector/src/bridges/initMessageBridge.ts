import {Connector, IFeatures} from "../Connector";
import {UiApi} from "../Ui";
import initLnwMessageBridge from "./initLnwMessageBridge";
import initRelaxMessageBridge from "./initRelaxMessageBridge";
import initPlaytechMessageBridge from "./initPlaytechMessageBridge";
import initTequityEditorBridge from "./initTequityEditorBridge";

export default async function initMessageBridge(connector: Connector, ui: () => UiApi, features: IFeatures = {}): Promise<void> {
    switch (connector.settings.operator) {
        case "relax":
            return initRelaxMessageBridge(connector);
        case "lnw":
            return initLnwMessageBridge(connector, ui, features);
        case "playtech":
            return initPlaytechMessageBridge(connector);
        case "tequity-editor":
            return initTequityEditorBridge(connector);
    }
}

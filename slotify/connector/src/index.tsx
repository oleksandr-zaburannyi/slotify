import {Connector, ICallbacks, IFeatures} from "./Connector";
import createUI, {ITheme} from "./Ui";
import initLocale from "./locale";
import {applySettings, ISettings} from "./settings";
import initMessageBridge from "./bridges/initMessageBridge";

export const create = async function (inlineSettings?: ISettings, callbacks?: ICallbacks, theme?: ITheme, features?: IFeatures) {
    const settings = applySettings(inlineSettings);
    await initLocale(settings.language || navigator.language);
    const ui = createUI(theme, callbacks);
    const connector = new Connector(ui, settings, callbacks);
    await initMessageBridge(connector, ui, features);
    return connector;
};

(window as any).connector = {create};

/* eslint-disable @typescript-eslint/no-empty-object-type */
import type {ThemeConfig} from "antd/es/config-provider/context";

declare module "styled-components" {
    export interface DefaultTheme extends ThemeConfig {}
}

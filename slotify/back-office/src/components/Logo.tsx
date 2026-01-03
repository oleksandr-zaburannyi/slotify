import React from "react";
import env from "../lib/env";

const Logo = ({width, height}: {width?: string; height?: string}) => {
    return <object type="image/svg+xml" aria-label={"logo"} data={env.VITE_LOGO ? env.VITE_LOGO : `/backoffice/logo.svg`} height={width} width={height} />;
};

export default Logo;

import {getPromoIcon} from "./promoIcons";
import {RotateRight} from "grommet-icons";
import {FC} from "react";

const FreeBetsHeaderIcon: FC = () => {
    const customPromoIcon = getPromoIcon("freeBets", "freeBetsHeaderIcon");
    return customPromoIcon ? <div dangerouslySetInnerHTML={{__html: customPromoIcon}} /> : <RotateRight size={"38"} color={"control"} />;
};

export default FreeBetsHeaderIcon;

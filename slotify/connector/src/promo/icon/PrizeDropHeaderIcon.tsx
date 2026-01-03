import {getPromoIcon} from "./promoIcons";
import {Gift} from "grommet-icons";
import {FC} from "react";

const PrizeDropHeaderIcon: FC = () => {
    const customPromoIcon = getPromoIcon("prizeDrop", "prizeDropHeaderIcon");

    return customPromoIcon ? <div dangerouslySetInnerHTML={{__html: customPromoIcon}} /> : <Gift size={"38"} color={"control"} />;
};

export default PrizeDropHeaderIcon;

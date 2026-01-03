import {getPromoIcon} from "./promoIcons";
import {Trophy} from "grommet-icons";
import {FC} from "react";

const TournamentHeaderIcon: FC = () => {
    const customPromoIcon = getPromoIcon("tournament", "tournamentHeaderIcon");

    return customPromoIcon ? <div dangerouslySetInnerHTML={{__html: customPromoIcon}} /> : <Trophy size={"38"} color={"control"} />;
};

export default TournamentHeaderIcon;

import {Entity} from "typeorm";
import {Session} from "./Session";

@Entity()
export class SessionArchive extends Session {}

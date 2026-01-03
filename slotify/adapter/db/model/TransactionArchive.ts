import {Entity} from "typeorm";
import {Transaction} from "./Transaction";

@Entity()
export class TransactionArchive extends Transaction {}

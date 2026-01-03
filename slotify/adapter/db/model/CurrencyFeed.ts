import {BaseEntity, Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class CurrencyFeed extends BaseEntity {
    @PrimaryColumn() public feed!: string;
    @Column() public enabled!: boolean;
    @Column({type: "jsonb"}) public currencies!: string[];
    @Column({type: "jsonb"}) public config!: any;
}

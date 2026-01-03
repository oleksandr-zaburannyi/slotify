import {BaseEntity, Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class RoundVerificationCache extends BaseEntity {
    @PrimaryColumn() key!: string;
    @Column({type: "jsonb"}) value: any;
}

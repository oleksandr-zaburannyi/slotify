import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryColumn} from "typeorm";
import {ITransactionResponse} from "../../util/routes";

@Entity()
export class CampaignResponse extends BaseEntity {
    @PrimaryColumn() public responseId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @Column({type: "jsonb"}) public response!: ITransactionResponse;
    @Column({type: "uuid", nullable: true}) public roundId?: string;
}

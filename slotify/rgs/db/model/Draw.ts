import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";
import {v5} from "uuid";

@Entity()
export class Draw extends BaseEntity {
    @PrimaryGeneratedColumn("increment", {type: "bigint"}) id!: number;
    @Column({type: "uuid"}) drawId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @Column({type: "uuid"}) roomId!: string;
    @Column({type: "bigint"}) nextTickTime!: number;
    @Column({type: "bigint"}) tickId!: number;
    @Column({type: "boolean"}) finished!: boolean;
    @Column({type: "jsonb", nullable: true}) state?: any;

    getNextDrawId() {
        return this.finished ? v5(this.drawId, this.drawId) : this.drawId;
    }
}

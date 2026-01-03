import {BaseEntity, Column, CreateDateColumn, Entity, In, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer} from "typeorm";
import {getConnection} from "@slotify/shared/lib/dbOptions";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

@Entity()
export class DrawWin extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") drawWinId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "uuid"}) playerId!: string;
    @Column({type: "uuid"}) roundId!: string;
    @Column({type: "uuid"}) drawId!: string;
    @Column({type: "bigint"}) tickId!: number;
    @Column({type: "decimal", transformer: toFloat}) amount!: number;
    @Column({type: "varchar"}) status!: "unpaid" | "finished";

    static async getByStatus(statuses: DrawWin["status"][]): Promise<DrawWin[]> {
        return await getConnection("replica").manager.findBy(DrawWin, {status: In(statuses)});
    }
}

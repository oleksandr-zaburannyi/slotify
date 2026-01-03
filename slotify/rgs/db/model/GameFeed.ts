import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class GameFeed extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @Column() game!: string;
    @PrimaryColumn({type: "uuid"}) roundId!: string;
    @PrimaryColumn() wagerStep!: number;
    @Column({type: "json"}) data!: any;
}

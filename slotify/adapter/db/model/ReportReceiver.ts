import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class ReportReceiver extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column() cron!: string;
    @Column() report!: string;
    @Column() account!: string;
    @Column() email!: string;
    @Column({nullable: true}) comment?: string;
    @Column({type: "json"}) variables?: any;
}

import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class AuditLog extends BaseEntity {
    @PrimaryGeneratedColumn() id!: string;
    @CreateDateColumn({type: "timestamptz"}) date!: Date;
    @Column({nullable: true}) email?: string;
    @Column() type!: string;
    @Column() action!: string;
    @Column({nullable: true, type: "json"}) variables?: any;
    @Column({nullable: true, type: "json"}) result?: string;
    @Column() success!: boolean;
    @Column() ip?: string;
    @Column() query?: string;
    @Column() isIpWhitelisted?: boolean;
}

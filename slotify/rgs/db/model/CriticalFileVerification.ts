import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class CriticalFileVerification extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") public id!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @Column() public fileId!: number;
    @Column() public loggedChecksum?: string;
    @Column() public declaredChecksum?: string;
}

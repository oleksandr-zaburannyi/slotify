import {IToolType} from "../../tools/tools";
import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity()
export class Theme extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") public themeId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "varchar"}) public name!: string;
    @Column({type: "varchar"}) public campaignType!: IToolType;
    @Column({type: "jsonb"}) public translations!: Record<string, Record<string, string>>;
    @Column({type: "jsonb"}) public icons!: Record<string, string>;
}

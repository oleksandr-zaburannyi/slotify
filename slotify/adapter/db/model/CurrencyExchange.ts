import {BaseEntity, Column, Entity, PrimaryGeneratedColumn, ValueTransformer} from "typeorm";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

@Entity()
export class CurrencyExchange extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column() date!: Date;
    @Column() currency!: string;
    @Column({type: "decimal", transformer: toFloat}) rate!: number;
}

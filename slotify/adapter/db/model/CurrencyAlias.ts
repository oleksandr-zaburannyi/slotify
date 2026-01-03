import {BaseEntity, Column, Entity, PrimaryGeneratedColumn, ValueTransformer} from "typeorm";
import cache from "@slotify/shared/lib/cache";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

@Entity()
export class CurrencyAlias extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column() currency!: string;
    @Column() alias!: string;
    @Column({type: "decimal", transformer: toFloat}) multiplier!: number;

    static getAll = cache(5 * 60, async () => await CurrencyAlias.find(), ["currencyAliases"]);
}

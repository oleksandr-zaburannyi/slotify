import {BaseEntity, Column, Entity, PrimaryColumn, ValueTransformer} from "typeorm";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

export type IRoundVerificationAction = "passed" | "alerted" | "rejected";
export type IRoundVerificationCheck = {points: number; description: string};
export type IRoundVerificationDetails = {
    checks: IRoundVerificationCheck[];
};

@Entity()
export class RoundVerification extends BaseEntity {
    @PrimaryColumn() roundId!: string;
    @Column({type: "decimal", transformer: toFloat}) score!: number;
    @Column({type: "varchar"}) action!: IRoundVerificationAction;
    @Column({type: "json"}) details!: IRoundVerificationDetails;
}

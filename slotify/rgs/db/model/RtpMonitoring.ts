import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer} from "typeorm";
import {SampleLog} from "../../compliance/rtp/updateCalculus";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};
const toInt: ValueTransformer = {to: value => (value ? parseInt(value, 10) : value), from: value => (value ? parseInt(value, 10) : value)};
const withFixedDates: ValueTransformer = {
    to: value => value,
    from: samples =>
        samples.map((sample: SampleLog) => ({
            ...sample,
            startDate: new Date(sample.startDate),
            endDate: new Date(sample.endDate),
        })),
};

@Entity()
export class RtpMonitoring extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column() game!: string;
    @Column({nullable: true}) variant?: string;
    @Column({type: "decimal", transformer: toFloat}) declaredRtp!: number;
    @Column({type: "json", nullable: true, transformer: withFixedDates}) calculus!: SampleLog[];
    @Column({transformer: toInt}) sampleCount!: number;
    @Column({type: "decimal", nullable: true, transformer: toFloat}) sampleRtp?: number;
    @Column({type: "decimal", nullable: true, transformer: toFloat}) sampleVariance?: number;
    @Column({type: "decimal", nullable: true, transformer: toFloat}) sampleMarginOfError?: number;
}

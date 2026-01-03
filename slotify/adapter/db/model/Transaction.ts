import {BaseEntity, Column, CreateDateColumn, Entity, IsNull, ManyToOne, Not, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer} from "typeorm";
import {ITransaction} from "../../walletAdapter/IWalletAdapter";
import {Player} from "./Player";
import Exception from "@slotify/shared/lib/Exception";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {anonymiseIp} from "../../util/ip";

const toFloat: ValueTransformer = {to: value => value, from: value => (value ? parseFloat(value) : value)};

export type TransactionStatus = "started" | "finished" | "failed" | "cancel" | "cancelled" | "rejected";
export type TransactionType = "deposit" | "withdraw";

export type IRegulatory = {
    pt?: {
        "sm_result"?: string;
        "descr_ap"?: string;
        [key: string]: any;
    };
};

export type ITransactionData = {
    roundIdBigInt?: string;
    transactionIdBigInt?: string;
    finalizeRelaxRound?: boolean;
};

export type ICampaignData = {
    total: number;
    used: number;
    amount: number;
    totalWin: number;
};

@Entity()
export class Transaction extends BaseEntity {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column({type: "timestamptz", nullable: true}) finishedAt?: Date;
    @Column({type: "timestamptz", nullable: true}) cancelledAt?: Date;
    @Column() type!: TransactionType;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) amount!: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) normalisedAmount?: number | null;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) jackpotAmount?: number;
    @Column() rgsRoundId?: string;
    @Column() roundId!: string;
    @Column() sessionId?: string;
    @Column() status!: TransactionStatus;
    @Column({nullable: true, type: "varchar"}) failReason?: string | null;
    @Column() game!: string;
    @Column({nullable: true}) variant?: string;
    @Column({nullable: true}) roundFinished!: boolean;
    @Column({nullable: true}) provider?: string;
    @Column({nullable: true}) rgs!: string;
    @Column({nullable: true}) rgsTransactionId!: string;
    @ManyToOne(() => Player, player => player.transactions, {createForeignKeyConstraints: false}) player!: Player;
    @Column({type: "uuid"}) playerId!: string;
    @Column({nullable: true}) category?: string;
    @Column({nullable: true}) name?: string;
    @Column({nullable: true}) channel?: string;
    @Column({nullable: true}) campaignType?: string;
    @Column({nullable: true}) campaignId?: string;
    @Column({nullable: true}) walletCampaignId?: string;
    @Column({nullable: true, type: "jsonb"}) campaignData?: ICampaignData;
    @Column({nullable: true}) ip?: string;
    @Column({}) auto!: boolean;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) balanceAfter!: number;
    @Column({nullable: true, type: "decimal", transformer: toFloat}) winRatio?: number;
    @Column({nullable: true, type: "jsonb"}) regulatory?: IRegulatory;
    @Column({nullable: true, type: "jsonb"}) data?: ITransactionData;

    static async getFailedDeposits(): Promise<Transaction[]> {
        return await getConnection("replica").manager.find(Transaction, {where: {status: "failed", type: "deposit"}, relations: ["player"]});
    }

    static async getToCancel(): Promise<Transaction[]> {
        return await getConnection("replica").manager.find(Transaction, {where: {status: "cancel"}, relations: ["player"]});
    }

    static async getFirst(): Promise<Transaction | null> {
        return await getConnection("replica").manager.findOne(Transaction, {where: {finishedAt: Not(IsNull())}, order: {finishedAt: "ASC"}});
    }

    static async findTransaction(rgs: string, rgsTransactionId: string): Promise<Transaction | null> {
        if (!rgs || !rgsTransactionId) throw new Exception("Specify rgs and rgsTransactionId", {data: {rgs, rgsTransactionId}});
        return await Transaction.findOneBy({rgs, rgsTransactionId});
    }

    static async start(id: string, transaction: ITransaction, sessionId: string, normalisedAmount: number | null): Promise<Date> {
        const insertResult = await Transaction.insert({...transaction, id, sessionId, status: "started", ip: anonymiseIp(transaction.ip), normalisedAmount});
        const raw = insertResult.raw[0];
        return raw.createdAt;
    }

    static async finish(id: string, balanceAfter: number | undefined = undefined, auto: boolean = false): Promise<void> {
        await Transaction.update({id}, {status: "finished", balanceAfter, auto, finishedAt: new Date()});
    }

    static async failed(id: string, failReason: string | null): Promise<void> {
        await Transaction.update({id}, {status: "failed", failReason});
    }

    static async rejected(id: string, failReason: string | null): Promise<void> {
        await Transaction.update({id}, {status: "rejected", failReason});
    }

    static async cancel(id: string): Promise<void> {
        await Transaction.update({id}, {status: "cancel"});
    }

    static async cancelled(id: string): Promise<void> {
        await Transaction.update({id}, {status: "cancelled", cancelledAt: new Date()});
    }
}

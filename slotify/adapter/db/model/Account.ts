import {BaseEntity, Column, CreateDateColumn, Entity, Not, PrimaryGeneratedColumn} from "typeorm";
import * as bcrypt from "bcrypt";
import {IAccount} from "@slotify/shared/lib/graphQLApi";
import {internalIPRanges} from "../../util/ip";
import {checkIPWhitelisting} from "@slotify/shared/lib/ip";

const SALT_ROUNDS: number = 10;

@Entity()
export class Account extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column() email!: string;
    @Column() password!: string;
    @Column({nullable: true}) comment?: string;
    @Column({nullable: true, type: "json"}) permissions?: string[];
    @Column({nullable: true, type: "json"}) rgss?: string[];
    @Column({nullable: true, type: "json"}) providers?: string[];
    @Column({nullable: true, type: "json"}) wallets?: string[];
    @Column({nullable: true, type: "json"}) operators?: string[];
    @Column({nullable: true, type: "json"}) brands?: string[];
    @Column({nullable: true, type: "json"}) ips?: string[];
    @CreateDateColumn({type: "timestamptz", nullable: true}) lastActivity?: Date | null;
    @Column() activeSession?: boolean;

    static hashPassword(password: string) {
        return bcrypt.hashSync(password, SALT_ROUNDS);
    }

    static async validate(email: string, password: string): Promise<Account> {
        const account = await Account.findOneBy({email, password: Not("")});
        if (!account || !account.password) throw new Error("Incorrect email or password");
        if (!bcrypt.compareSync(password, account.password)) throw new Error("Incorrect email or password");
        return account;
    }

    toData(): IAccount {
        const {permissions, rgss, providers, wallets, operators, brands, email} = this;
        return {permissions, rgss, providers, wallets, operators, brands, email};
    }

    isWhitelisted(ip: string): boolean {
        return checkIPWhitelisting(ip, [...internalIPRanges, ...(this.ips || [])]);
    }
}

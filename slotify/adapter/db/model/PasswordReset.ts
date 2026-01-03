import {BaseEntity, Column, CreateDateColumn, Entity, MoreThan, PrimaryGeneratedColumn} from "typeorm";
import {DateTime} from "../../util/luxon";

@Entity()
export class PasswordReset extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @Column() email!: string;
    @Column() key!: string;

    static KEY_EXPIRY_HOURS = 24 * 3;
    static NEW_KEY_REQUEST_OFFSET_MINUTES = 5;

    static async hasActiveKey(email: string): Promise<boolean> {
        return !!(await PasswordReset.findOneBy({email, createdAt: MoreThan(DateTime.local().minus({minutes: this.NEW_KEY_REQUEST_OFFSET_MINUTES}).toJSDate())}));
    }

    static async isKeyActive(key: string): Promise<boolean> {
        return !!(await PasswordReset.findOneBy({key, createdAt: MoreThan(DateTime.local().minus({hours: this.KEY_EXPIRY_HOURS}).toJSDate())}));
    }
}

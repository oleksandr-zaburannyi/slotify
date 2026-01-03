import {BaseEntity, Column, CreateDateColumn, DeepPartial, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {CriticalFileVerification} from "./CriticalFileVerification";

@Entity()
export class CriticalFile extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number;
    @Column() name!: string;
    @Column() component!: string;
    @Column() origin!: string;
    @Column() service!: string;
    @Column() path!: string;
    @Column() declaredChecksum!: string;
    @Column({nullable: true, type: "json"}) jurisdictions?: string[];
    @Column() blockOnError!: boolean;
    @Column() comment?: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @UpdateDateColumn({type: "timestamptz"}) updatedAt!: Date;
    @Column() loggedChecksum?: string;

    static async createWithInitialVerification(data: DeepPartial<CriticalFile>, loggedChecksum: string) {
        data.loggedChecksum = loggedChecksum;
        data.declaredChecksum = data.declaredChecksum || loggedChecksum; // append logged checksum if user left declared checksum empty
        let criticalFile: CriticalFile;
        await getConnection("primary").transaction(async manager => {
            criticalFile = await manager.save(CriticalFile, CriticalFile.create(data));
            await manager.save(CriticalFileVerification, CriticalFileVerification.create({fileId: criticalFile.id, declaredChecksum: data.declaredChecksum, loggedChecksum}));
        });
        return criticalFile!;
    }

    static async updateWithInitialVerification(id: number, data: DeepPartial<CriticalFile>, loggedChecksum: string) {
        data.loggedChecksum = loggedChecksum;
        data.declaredChecksum = data.declaredChecksum || loggedChecksum; // append logged checksum if user left declared checksum empty

        await getConnection("primary").transaction(async manager => {
            await manager.update(CriticalFile, {id}, data);
            await manager.save(CriticalFileVerification, CriticalFileVerification.create({fileId: id, declaredChecksum: data.declaredChecksum, loggedChecksum}));
        });
    }
}

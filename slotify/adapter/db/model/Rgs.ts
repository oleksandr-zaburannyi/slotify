import Exception from "@slotify/shared/lib/Exception";
import {BaseEntity, Column, Entity, PrimaryColumn} from "typeorm";
import cache from "@slotify/shared/lib/cache";

@Entity()
export class Rgs extends BaseEntity {
    @PrimaryColumn() id!: string;
    @Column() adapter!: string;
    @Column({type: "json"}) config!: any;
    @Column({type: "json"}) inspectionConfig?: any;
    @Column({type: "json"}) ips?: string[];

    static getRgss = cache(5 * 60, () => Rgs.find(), ["rgss"]);

    static async getById(id: string): Promise<Rgs> {
        const rgsById = (await Rgs.getRgss()).find(rgs => rgs.id === id);
        if (rgsById) return rgsById;

        throw new Exception("Couldn't find RGS", {data: {id}});
    }
}

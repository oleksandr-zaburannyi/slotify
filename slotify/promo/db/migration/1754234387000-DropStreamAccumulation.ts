import {MigrationInterface, QueryRunner} from "typeorm";
import {CreateStreamAccumulation1746365190001} from "./1746365190001-CreateStreamAccumulation";

export class DropStreamAccumulation1754234387000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await new CreateStreamAccumulation1746365190001().down(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await new CreateStreamAccumulation1746365190001().up(queryRunner);
    }
}

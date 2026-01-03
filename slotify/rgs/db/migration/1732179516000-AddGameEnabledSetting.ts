import {MigrationInterface, QueryRunner} from "typeorm";
import {Settings} from "../model/Settings";

export class AddGameEnabledSetting1732179516000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            `
                INSERT INTO rgs_settings (priority, key, value, "serverOnly")
                VALUES ($1, $2, $3, $4)
            `,
            [0, "gameEnabled", "true", true],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.manager.delete(Settings, {priority: 0, key: "gameEnabled", value: "true"});
    }
}

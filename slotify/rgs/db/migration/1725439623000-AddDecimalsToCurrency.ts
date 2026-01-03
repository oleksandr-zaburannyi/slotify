import {MigrationInterface, TableColumn} from "typeorm";
import {QueryRunner} from "typeorm/query-runner/QueryRunner";
import {Currency} from "../model/Currency";

//list of currencies with decimals != 2
//FIAT values taken from https://en.wikipedia.org/wiki/ISO_4217
const currencies: Record<string, number> = {
    btc: 8,
    clp: 0,
    dog: 8,
    eth: 9,
    jpy: 0,
    ltc: 8,
    tnd: 3,
    usdt: 8,
    ppc: 8,
    trx: 6,
    bnb: 8,
    avc: 8,
    bsv: 8,
    dot: 8,
    eos: 8,
    trtl: 8,
    vndc: 8,
    vsys: 8,
    xlm: 7,
    nbx: 8,
    neo: 0,
    ada: 6,
    cake: 9,
    dash: 8,
    ksm: 9,
    axs: 9,
    amp: 9,
    crv: 9,
    cro: 9,
    shib: 9,
    btt: 6,
    sol: 9,
    isk: 0,
    krw: 0,
    pyg: 0,
    ugx: 0,
    vnd: 0,
    xaf: 0,
    xof: 0,
};

export class AddDecimalsToCurrency1725439623000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.addColumn(queryRunner.connection.options.entityPrefix + "currency", new TableColumn({name: "decimals", type: "integer", default: 2}));
        for (const [currency, decimals] of Object.entries(currencies)) {
            await queryRunner.manager.update(Currency, {currency}, {decimals});
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropColumn(queryRunner.connection.options.entityPrefix + "currency", "decimals");
    }
}

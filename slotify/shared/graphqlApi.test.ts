// noinspection SqlResolve

import {generate, IColumn, IFilter, IJoin, ISort} from "./graphQLApi";
import {BaseEntity, Column, DataSource, Entity, PrimaryColumn} from "typeorm";
import {getConnection} from "./dbOptions";

@Entity()
class TestEntity extends BaseEntity {
    @PrimaryColumn() id!: number;
    @Column() myColumn!: string;
}

///
@Entity()
class AnotherEntity extends BaseEntity {
    @PrimaryColumn() id!: number;
    @Column() testEntityId!: number;
}

jest.mock("./dbOptions");

let dataSource: DataSource;
let queries: [string, any[]][] = [];
const setTotalCost = (cost: number) => (dataSource.query = async () => [{"QUERY PLAN": [{"Plan": {"Total Cost": cost}}]}] as any);
afterEach(() => {
    queries = [];
});
beforeAll(async () => {
    const mockedGetConnection = getConnection as jest.MockedFunction<typeof getConnection>;

    dataSource = new DataSource({type: "postgres", entities: [TestEntity, AnotherEntity]});
    dataSource.driver.connect = jest.fn();
    dataSource.driver.afterConnect = jest.fn();
    dataSource.driver.disconnect = jest.fn();
    await dataSource.initialize();

    const createQueryBuilder = dataSource.createQueryBuilder;
    dataSource.createQueryBuilder = (...args: any[]) => {
        const queryBuilder = createQueryBuilder.call(dataSource, ...args);
        queryBuilder.getRawMany = async () => {
            queries.push(queryBuilder.getQueryAndParameters());
            return [];
        };
        return queryBuilder;
    };
    mockedGetConnection.mockReturnValue(dataSource);
});
describe("graphQLApi", () => {
    test("generate - select", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn"},
        ];
        await generate(TestEntity, "te", [], columns, undefined, undefined, 100, 0);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "te"."myColumn" AS "myColumn" FROM "test_entity" "te" LIMIT 101 OFFSET 0`, []], // @formatter:off
        );
    });

    test("generate - skip select", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", skipSelect: true},
        ];
        await generate(TestEntity, "te", [], columns, undefined, undefined, 100, 0);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id" FROM "test_entity" "te" LIMIT 101 OFFSET 0`, []], // @formatter:off
        );
    });

    test("generate - join", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "testEntityId", sql: "anotherEntity.testEntityId"},
        ];
        const joins: IJoin[] = [{entity: AnotherEntity, alias: "anotherEntity", condition: "te.id = anotherEntity.testEntityId"}];
        await generate(TestEntity, "te", joins, columns, undefined, undefined, 100, 0);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "anotherEntity"."testEntityId" AS "testEntityId" FROM "test_entity" "te" LEFT JOIN "another_entity" "anotherEntity" ON "te"."id" = "anotherEntity"."testEntityId" LIMIT 101 OFFSET 0`, []], // @formatter:off
        );
    });

    test("generate - limit and offset", async () => {
        const columns: IColumn[] = [{alias: "id", sql: "te.id"}];
        await generate(TestEntity, "te", [], columns, undefined, undefined, 20, 10);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id" FROM "test_entity" "te" LIMIT 21 OFFSET 10`, []], // @formatter:off
        );
    });

    test("generate -group by", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", group: true},
        ];
        await generate(TestEntity, "te", [], columns, undefined, undefined, 10, undefined);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "te"."myColumn" AS "myColumn" FROM "test_entity" "te" GROUP BY "te"."myColumn" LIMIT 11 OFFSET 0`, []], // @formatter:off
        );
    });

    test("generate - sort", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn"},
        ];
        setTotalCost(0);
        const sort: ISort = {field: "myColumn", order: "DESC"};
        await generate(TestEntity, "te", [], columns, sort, undefined, 10, undefined);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "te"."myColumn" AS "myColumn" FROM "test_entity" "te" ORDER BY "te"."myColumn" DESC LIMIT 11 OFFSET 0`, []], // @formatter:off
        );
    });

    test("generate - sort json", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", type: "json"},
        ];
        setTotalCost(0);
        const sort: ISort = {field: "myColumn", order: "DESC"};
        await generate(TestEntity, "te", [], columns, sort, undefined, 10, undefined);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "te"."myColumn" AS "myColumn" FROM "test_entity" "te" ORDER BY ("te"."myColumn")::varchar DESC LIMIT 11 OFFSET 0`, []], // @formatter:off
        );
    });

    test("generate - sort too expensive", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn"},
        ];
        setTotalCost(500 * 1000 + 1);
        const sort: ISort = {field: "myColumn", order: "ASC"};
        await expect(generate(TestEntity, "te", [], columns, sort, undefined, 10, undefined)).rejects.toThrow("Sorting column 'myColumn' is too expensive. Add some filters to limit data scope and retry");
    });

    test("generate - sort not existing", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn"},
        ];
        setTotalCost(200 * 1000 + 1);
        const sort: ISort = {field: "notExisting", order: "ASC"};
        await expect(generate(TestEntity, "te", [], columns, sort, undefined, 10, undefined)).rejects.toThrow("Not existing sort column 'notExisting'");
    });

    test("generate - sort not allowed", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", sort: false},
        ];
        setTotalCost(200 * 1000 + 1);
        const sort: ISort = {field: "myColumn", order: "ASC"};
        await expect(generate(TestEntity, "te", [], columns, sort, undefined, 10, undefined)).rejects.toThrow("Sorting column 'myColumn' is not allowed.");
    });

    test("generate - filter not existing", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn"},
        ];
        const filter: IFilter[] = [{type: "EQUAL", field: "notExisting", value: "test"}];
        await expect(generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined)).rejects.toThrow("Not existing filter column 'notExisting'");
    });

    test("generate - filter not supported", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", filters: ["GREATER", "GREATER_OR_EQUAL"]},
        ];
        const filter: IFilter[] = [{type: "EQUAL", field: "myColumn", value: "test"}];
        await expect(generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined)).rejects.toThrow("Filter 'EQUAL' is not supported on column 'myColumn'.");
    });

    test("generate - filter uuid not correct", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", type: "uuid", filters: ["EQUAL"]},
        ];
        const filter: IFilter[] = [{type: "EQUAL", field: "myColumn", value: "test"}];
        await expect(generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined)).rejects.toThrow("Filter on column 'myColumn' should be uuid type.");
    });

    test("generate - filter uuid not correct - array", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", type: "uuid", filters: ["EQUAL"]},
        ];
        const filter: IFilter[] = [{type: "EQUAL", field: "myColumn", value: ["test"]}];
        await expect(generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined)).rejects.toThrow("Filter on column 'myColumn' should be uuid type.");
    });

    test("generate - filter IN  correct", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", filters: ["IN"]},
        ];
        const filter: IFilter[] = [{type: "IN", field: "myColumn", value: ["a", "b"]}];
        await generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "te"."myColumn" AS "myColumn" FROM "test_entity" "te" WHERE ("te"."myColumn") IN ($1, $2) LIMIT 11 OFFSET 0`, ["a", "b"]], // @formatter:off
        );
    });

    test("generate - filter IN not correct - empty array", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", filters: ["IN"]},
        ];
        const filter: IFilter[] = [{type: "IN", field: "myColumn", value: []}];
        await expect(generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined)).rejects.toThrow("Filter value should be non-empty array.");
    });

    test("generate - filter", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id"},
            {alias: "myColumn", sql: "te.myColumn", filters: ["EQUAL"]},
        ];
        const filter: IFilter[] = [{type: "EQUAL", field: "myColumn", value: "test"}];
        await generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "te"."myColumn" AS "myColumn" FROM "test_entity" "te" WHERE ("te"."myColumn") = $1 LIMIT 11 OFFSET 0`, ["test"]], // @formatter:off
        );
    });

    test("generate - filter multiple", async () => {
        const columns: IColumn[] = [
            {alias: "id", sql: "te.id", filters: ["GREATER"]},
            {alias: "myColumn", sql: "te.myColumn", filters: ["LIKE"]},
        ];
        const filter: IFilter[] = [
            {type: "GREATER", field: "id", value: 123},
            {type: "LIKE", field: "myColumn", value: "%my value%"},
        ];
        await generate(TestEntity, "te", [], columns, undefined, filter, 10, undefined);
        expect(queries[0]).toEqual(
            [`SELECT "te"."id" AS "id", "te"."myColumn" AS "myColumn" FROM "test_entity" "te" WHERE ("te"."id") > $1 AND ("te"."myColumn")::varchar LIKE $2 LIMIT 11 OFFSET 0`, [123, "%my value%"]], // @formatter:off
        );
    });
});

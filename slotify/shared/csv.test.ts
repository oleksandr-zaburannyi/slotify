import {toCSV} from "./csv";

describe("toCSV", () => {
    it("should use comma as separator", () => {
        const items = [{name: "John", age: 30}];
        const csv = toCSV(items);
        expect(csv).toBe('"name","age"\n"John","30"');
    });

    it("should handle arrays in values (comma inside quoted field)", () => {
        const items = [{tags: "a,b,c", status: "active"}];
        const csv = toCSV(items);
        expect(csv).toBe('"tags","status"\n"a,b,c","active"');
    });

    it("should escape quotes in values using RFC 4180 doubled quotes", () => {
        const items = [{name: 'John "Jack" Doe', age: 30}];
        const csv = toCSV(items);
        expect(csv).toBe('"name","age"\n"John ""Jack"" Doe","30"');
    });

    it("should handle objects by stringifying to JSON with RFC 4180 escaped quotes", () => {
        const items = [{config: {enabled: true, items: ["a", "b"]}}];
        const csv = toCSV(items);
        expect(csv).toBe('"config"\n"{""enabled"":true,""items"":[""a"",""b""]}"');
    });

    it("should handle null and undefined values as empty strings", () => {
        const items = [{name: null, status: undefined, value: "test"}];
        const csv = toCSV(items);
        expect(csv).toBe('"name","status","value"\n"","","test"');
    });

    it("should handle empty array", () => {
        const items: any[] = [];
        const csv = toCSV(items);
        expect(csv).toBe("\n");
    });

    it("should handle multiple rows", () => {
        const items = [
            {name: "John", age: 30},
            {name: "Jane", age: 25},
        ];
        const csv = toCSV(items);
        expect(csv).toBe('"name","age"\n"John","30"\n"Jane","25"');
    });
});

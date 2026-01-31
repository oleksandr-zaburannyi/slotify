import {detectSeparator, parseCSVLine, revertEscapedCharacters} from "./importCSV";

describe("CSV Import Format Detection and Parsing", () => {
    describe("detectSeparator", () => {
        it("should detect old format with semicolon separator", () => {
            expect(detectSeparator('"name";"age"')).toBe(";");
        });

        it("should detect new format with comma separator", () => {
            expect(detectSeparator('"name","age"')).toBe(",");
        });

        it("should detect new format even with semicolon inside value", () => {
            // New format with semicolon in column name (unlikely but valid)
            expect(detectSeparator('"na;me","age"')).toBe(",");
        });

        it("should detect old format from backslash-escaped semicolons", () => {
            // Single-column old format with escaped semicolon
            expect(detectSeparator('"value\\;test"')).toBe(";");
        });

        it("should detect old format from backslash-escaped quotes", () => {
            // Single-column old format with escaped quote
            expect(detectSeparator('"value\\"test"')).toBe(";");
        });

        it("should detect new format for single-column without escapes", () => {
            expect(detectSeparator('"name"')).toBe(",");
        });
    });

    describe("parseCSVLine - new format (comma separator)", () => {
        it("should parse simple fields", () => {
            const fields = parseCSVLine('"name","age"', ",");
            expect(fields).toEqual(["name", "age"]);
        });

        it("should handle comma inside quoted field (array-like values)", () => {
            const fields = parseCSVLine('"a,b,c","active"', ",");
            expect(fields).toEqual(["a,b,c", "active"]);
        });

        it("should handle RFC 4180 escaped quotes (doubled quotes) inside field", () => {
            const fields = parseCSVLine('"John ""Jack"" Doe","30"', ",");
            expect(fields.map(f => revertEscapedCharacters(f, false))).toEqual(['John "Jack" Doe', "30"]);
        });
    });

    describe("parseCSVLine - old format (semicolon separator)", () => {
        it("should parse simple fields", () => {
            const fields = parseCSVLine('"name";"age"', ";");
            expect(fields).toEqual(["name", "age"]);
        });

        it("should handle escaped semicolon inside value", () => {
            const fields = parseCSVLine('"a\\;b";"c"', ";");
            expect(fields.map(f => revertEscapedCharacters(f, true))).toEqual(["a;b", "c"]);
        });

        it("should handle escaped quotes", () => {
            const fields = parseCSVLine('"John \\"Jack\\"";"30"', ";");
            expect(fields.map(f => revertEscapedCharacters(f, true))).toEqual(['John "Jack"', "30"]);
        });

        it("should handle comma inside value (not separator in old format)", () => {
            const fields = parseCSVLine('"a,b,c";"active"', ";");
            expect(fields.map(f => revertEscapedCharacters(f, true))).toEqual(["a,b,c", "active"]);
        });
    });

    describe("backward compatibility", () => {
        it("should correctly parse old format CSV", () => {
            const oldFormatCSV = '"name";"tags";"status"\n"John";"a,b,c";"active"';
            const lines = oldFormatCSV.split("\n");
            const separator = detectSeparator(lines[0]);
            expect(separator).toBe(";");

            const [headers, data] = lines.map(line => parseCSVLine(line, separator));
            expect(headers).toEqual(["name", "tags", "status"]);
            expect(data.map(f => revertEscapedCharacters(f, true))).toEqual(["John", "a,b,c", "active"]);
        });

        it("should correctly parse new format CSV", () => {
            const newFormatCSV = '"name","tags","status"\n"John","a,b,c","active"';
            const lines = newFormatCSV.split("\n");
            const separator = detectSeparator(lines[0]);
            expect(separator).toBe(",");

            const [headers, data] = lines.map(line => parseCSVLine(line, separator));
            expect(headers).toEqual(["name", "tags", "status"]);
            expect(data.map(f => revertEscapedCharacters(f, false))).toEqual(["John", "a,b,c", "active"]);
        });
    });
});

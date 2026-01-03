import {expect} from "@jest/globals";
import checksum from "./checksum";

test("checksum", async () => {
    expect(checksum("abc")).toEqual("a9993e364706816aba3e25717850c26c9cd0d89d");
});

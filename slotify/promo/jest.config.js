module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    collectCoverage: true,
    coverageReporters: ["html", ["lcovonly", {"projectRoot": "../.."}], "text-summary"],
    collectCoverageFrom: ["!*.json", "!db/migration/**/*", "!lib/**/*", "!test/**/*", "!coverage/**/*", "!.eslintrc.js", "!jest.config.js"],
    testPathIgnorePatterns: ["/lib/"],
};

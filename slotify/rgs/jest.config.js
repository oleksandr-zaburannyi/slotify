module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    collectCoverage: true,
    coverageReporters: ["html", ["lcovonly", {"projectRoot": "../.."}], "text-summary"],
    collectCoverageFrom: ["!*.json", "!db/migration/**/*", "!lib/**/*", "!test/**/*", "!coverage/**/*", "!.eslintrc.js", "!jest.config.js"],
    testPathIgnorePatterns: ["/lib/"],
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                useESM: true,
            },
        ],
    },
    transformIgnorePatterns: ["node_modules/(?!(graphql-request|@graphql-tools)/)"],
    extensionsToTreatAsEsm: [".ts"],
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};

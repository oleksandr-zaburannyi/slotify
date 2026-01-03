export function setEnvVariables() {
    process.env.PORT = "8010";
    process.env.DB_HOST = "localhost";
    process.env.REPLICA_DB_HOST = "localhost";
    process.env.DB_USERNAME = "postgres";
    process.env.DB_PASSWORD = "pass";
    process.env.DB_DATABASE = "slotify_test_" + new Date().getTime();
    process.env.DB_PORT = "5432";
    process.env.DB_FOLDER_PATH = ".";
    process.env.JWT_SECRET = "secret";
    process.env.ADAPTER_RGS_KEY = "rgs-key";
    process.env.ADAPTER_URL = "adapter-url";
    process.env.GAMES_SERVICES = "test-provider";
    process.env.BASE_CURRENCY = "eur";
    process.env.IS_PRODUCTION = "true";
    process.env.GAMES_TEST_PROVIDER_SERVICE_HOST = "localhost";
    process.env.GAMES_TEST_PROVIDER_SERVICE_PORT = "8090";
    process.env.DAYS_TO_ARCHIVE = "365";
}

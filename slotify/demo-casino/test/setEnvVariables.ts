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
    process.env.SECRET_KEY = "secret-key";
    process.env.BASE_CURRENCY = "eur";
}

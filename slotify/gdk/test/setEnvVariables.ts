export function setEnvVariables() {
    process.env.PORT = "8010";
    process.env.JWT_SECRET = "secret";
    process.env.GAMES_PATH = "test/game/*/index.ts";
    process.env.PROVIDER = "myProvider";
    process.env.RNG_ALGORITHM = "isaac";
}

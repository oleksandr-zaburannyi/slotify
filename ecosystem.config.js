let envs = {
    ENV: "local",
    IS_PRODUCTION: "false",
    JWT_SECRET: "secret",
    LOG_LEVEL: "info",
    RGS: "tequity",
    BASE_CURRENCY: "eur",
    NAME: "Tequity",
    URL: "http://localhost:8083",

    //database
    DB_HOST: "localhost",
    REPLICA_DB_HOST: "localhost",
    DB_USERNAME: "postgres",
    DB_PASSWORD: "pass",
    DB_DATABASE: "slotify_local",
    DB_PORT: 5432,

    //redis
    REDIS_PORT: 6379,

    /*
    MAIL_HOST: "smtp.gmail.com",
    MAIL_PORT: 465,
    MAIL_USER: "bo.tequity@gmail.com",
    MAIL_PASSWORD: "xxx"
    SUPPORT_EMAIL: "contact@tequity.ventures",
    */
};

const gameServices = [
    {
        name: "trading",
        cwd: "../trading-game-servers",
        port: 8093,
        envs: {
            FEEDS_CONFIG: [
                {feed: "bitfinex", currencies: ["BTC", "ETH"]},
                //{feed: "bitstamp", currencies: ["BTC", "ETH"]},
                {feed: "binance", currencies: ["BTC", "ETH"]},
                {feed: "bybit", currencies: ["BTC", "ETH"]},
                {feed: "coinbase", currencies: ["BTC", "ETH"]},
                //{feed: "gate", currencies: ["BTC", "ETH"]},
                {feed: "htx", currencies: ["BTC", "ETH"]},
                {feed: "kraken", currencies: ["BTC", "ETH"]},
                {feed: "kucoin", currencies: ["BTC", "ETH"]},
                {feed: "okx", currencies: ["BTC", "ETH"]},
            ]
        }
    },
    {
        name: "example-provider",
        cwd: "../example-game-servers",
        port: 8092,
    },
    {
        name: "test-provider",
        cwd: "../test-game-servers",
        port: 8091,
    },
    {
        name: "tequity",
        cwd: "../tequity-game-servers",
        port: 8090,
    },
];


const services = [
    {
        name: "postgres",
        cwd: "scripts",
        script: "start-db.sh",
    },
    {
        name: "redis",
        cwd: "scripts",
        script: "start-redis.sh",
    },
    {
        name: "proxy",
        cwd: "scripts",
        script: "start-proxy.sh",
    },
    {
        name: "adapter",
        cwd: "slotify/adapter",
        port: 8080,
        envs: {
            DEFAULT_RGS: "tequity",
            GRAPHQL_ENDPOINTS:
                "http://localhost:8081/graphql,http://localhost:8084/graphql,http://localhost:8086/graphql",
            ADAPTER_GRAPHQL_SERVICE_HOST: "localhost",
            ADAPTER_GRAPHQL_SERVICE_PORT: 8080
        },
    },
    {
        name: "promo",
        cwd: "slotify/promo",
        port: 8084,
        envs: {
            ADAPTER_RGS_KEY: "secret-rgs-key",
            RGS: "tequity",
        },
    },
    {
        name: "rgs",
        cwd: "slotify/rgs",
        port: 8081,
        envs: {
            ADAPTER_RGS_KEY: "secret-rgs-key",
            RGS: "tequity",
            GAMES_SERVICES: gameServices
                .map((service) => service.name)
                .join(","),
        },
    },
    {
        name: "demo-casino",
        cwd: "slotify/demo-casino",
        port: 8088,
        envs: {
            SECRET_KEY: "demo-secret",
        },
    },
    {
        name: "rng",
        cwd: "slotify/rng",
        port: 8086,
        envs: {
            SECRET_KEY: "demo-secret",
        },
    },
    {
        name: "websocket",
        cwd: "slotify/websocket",
        port: 8087,
        envs: {},
    },
    {
        name: "connector",
        cwd: "slotify/connector",
        port: 3001,
        envs: {},
    },
    {
        name: "back-office",
        cwd: "slotify/back-office",
        port: 8083,
        envs: {
            BROWSER: "none",
            VITE_BO_API_URL: "http://localhost:8080",
            VITE_NAME: "Tequity",
            VITE_LOGO: "",
            VITE_ENV: "local",
            VITE_BASE_CURRENCY: "eur",
            VITE_BASE_CURRENCY_DECIMALS: 2,
            VITE_IS_PRODUCTION: "false",
            VITE_HIDE_FOOTER: "false",
        },
    },
];


envs = {
    ...envs,
    ...services.reduce((prev, service) => ({
        [`${service.name.toUpperCase().replaceAll("-", "_")}_SERVICE_HOST`]: "localhost",
        [`${service.name.toUpperCase().replaceAll("-", "_")}_SERVICE_PORT`]: service.port,
        ...prev
    }), {}),
    ...gameServices.reduce((prev, service) => ({
        [`GAMES_${service.name.toUpperCase().replaceAll("-", "_")}_SERVICE_HOST`]: "localhost",
        [`GAMES_${service.name.toUpperCase().replaceAll("-", "_")}_SERVICE_PORT`]: service.port,
        ...prev
    }), {}),
};

module.exports = {
    apps: [...services, ...gameServices].map(service => ({
        name: service.name,
        time: true,
        cwd: service.cwd,
        script: service.script || "npm run start:dev",
        args: service.args,
        env: {...envs, ...service.envs, PORT: service.port},
    })),

}

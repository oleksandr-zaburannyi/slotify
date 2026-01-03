# Adapter Service

Adapter is Node application to connect multiple providers with multiple remote wallets.

## Dependencies

- [Node](https://nodejs.org/) v12 or later
- [PostgreSQL](https://www.postgresql.org/) v12 or later
- [Redis](https://www.redis.io/) v6 or later

## Environment variables

- `NODE_ENV`: `development` for local development or `production` for anything else
- `ENV`: name of the environment i.e. `staging` or `prod-eu`
- `IS_PRODUCTION`: disables verbose error responses and wallet verifier, this flag can be set to `false` only for secure non-production environments
- `PORT`: application port

- `DB_HOST`: database host
- `DB_PORT`: database port
- `REPLICA_DB_HOST`: read replica database host
- `REPLICA_DB_PORT`: read replica database port (if not specified then `DB_PORT` is used)
- `DB_USERNAME`: database user
- `DB_PASSWORD`: database password
- `DB_DATABASE`: database name
- `MAX_QUERY_COST` (optional): maximum cost of query done with `EXPLAIN` to apply query optimisations, default 100000

- `MAIL_HOST`: SMTP server host
- `MAIL_PORT`: SMTP server port
- `MAIL_USER`: e-mail user
- `MAIL_PASSWORD`: e-mail password
- `SLACK_WEBHOOK`: Slack webhook for alerting (https://api.slack.com/messaging/webhooks)

- `BASE_CURRENCY`: Base currency of the system (lowercase i.e. `eur`)
- `JWT_SECRET`: JWT private key for GraphQL API
- `NAME`: name of the company to be used i.e. in e-mails
- `GRAPHQL_ENDPOINTS`: (optional) comma separated URLs to GraphQL endpoints to stitch
- `COIN_API_KEY`: API key to coinapi.io for crypto feed
- `URL`: URL to the domain
- `API_BLOCKED_COUNTRIES`: (optional) Comma separated list of blocked countries (i.e. 'KP,SO,AF')
- `SESSION_EXPIRY_HOURS`: (optional, default `4`) Number of hours the session for accounts expires (unless IP is whitelisted)

- `LOG`: (optional) `gcp` for GCP logging or else for standard logging
- `LOG_LEVEL`: (optional, default `info`) Winston [log level](https://github.com/winstonjs/winston#logging-levels)

- `MAX_WITHDRAWS` (optional, default: `1`) - max withdrawals per round
- `MAX_DEPOSITS` (optional, default: `1`) - max deposits per round

- `SUPPORT_EMAIL` support email for alert notification emails
- `ANONYMISE_IPS` if `true` it will not store IP addresses

## Private NPM dependencies

NPM requires installing private `@slotify/shared` package. To have access to it you need to request private key. One of the ways to configure it is to create `.npmrc` file with the following content where `XXX` should be replaced with
private key.

```
//npm.pkg.github.com/:_authToken=XXX
@slotify:registry=https://npm.pkg.github.com/
```

After configuring token you can install and start the service.

## Running

```shell script
npm ci --omit=dev
npm start
```

## Starting development

```shell script
npm start:dev
```

## Testing

```shell script
npm test
```

## Building

```shell script
npm run build
```

## Routing

| Path        | Protocol   | Accessibility                   | Description             |
|-------------|------------|---------------------------------|-------------------------|
| `/launch/*` | `HTTP/1.1` | Public                          | Launches game client    |
| `/graphql`  | `HTTP/1.1` | Public                          | Back Office GraphQL API |
| `/rgs/*`    | `HTTP/1.1` | Cluster, VPN or IP whitelisting | API used by RGS's       |
| `/wallet/*` | `HTTP/1.1` | Cluster, VPN or IP whitelisting | API used by Wallets     |
| `/api/*`    | `HTTP/1.1` | Cluster                         | Internal APIs           |

It is advised to route `/graphql` traffic to dedicated instance of the service so heavy back office calls don't affect regular players.

## Health Check

`/health` returns:

- `OK` when everything works
- `QUITING` when process received `SIGTERM` signal
- `DB NOT CONNECTED` when couldn't establish database connection

## Storage

No

## Scalability

The service is stateless, so it's ready for horizontal scaling.

## Database migration

During launch of application it automatically handles database migration.

Each migration step is wrapped in transaction to prevent duplicated executions.

## Documentation

- [Adapter Guidebook](docs/ADAPTER_GUIDEBOOK.md)
- [Back Office API](docs/BACK_OFFICE_API.md)
- [Wallet Integration](docs/WALLET_INTEGRATION.md)
- [RGS Integration](docs/RGS_INTEGRATION.md)

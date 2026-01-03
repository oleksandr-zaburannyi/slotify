# Demo Casino Service

Demo Casino is Node application to simulate Remote Wallet used for (PFF) Play for Fun traffic.

## Dependencies

- [Node](https://nodejs.org/) v12 or later
- [PostgreSQL](https://www.postgresql.org/) v12 or later

## Environment variables

- `NODE_ENV`: `development` for local development or `production` for anything else
- `ENV`: name of the environment i.e. `staging` or `prod-eu`
- `IS_PRODUCTION`: disables verbose error responses, this flag can be set to `false` only for secure non-production environments
- `PORT`: application port

- `BASE_CURRENCY`: Base currency of the system (lowercase i.e. `eur`)
- `DB_HOST`: database host
- `DB_USERNAME`: database user
- `DB_PASSWORD`: database password
- `DB_DATABASE`: database name
- `DB_PORT`: database port

- `SECRET_KEY`: private key defined by Wallet Adapter configuration

- `LOG`: (optional) `gcp` for GCP logging or else for standard logging
- `LOG_LEVEL`: (optional, default `info`) Winston [log level](https://github.com/winstonjs/winston#logging-levels)

- `REQUEST_DELAY`: (optional, default `0`) delays all requests by given value in milliseconds

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

| Path     | Protocol   | Accessibility | Description        |
|----------|------------|---------------|--------------------|
| `/*`     | `HTTP/1.1` | Cluster       | Exposed wallet API |
| `/api/*` | `HTTP/1.1` | Cluster       | Internal APIs      |

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

- [Demo Casino Guidebook](docs/DEMO_CASINO_GUIDEBOOK.md)

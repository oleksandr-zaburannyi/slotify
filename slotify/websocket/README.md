# Slotify Websocket

Slotify Websocket is a Websocket gateway for other services.

## Dependencies

- [Node](https://nodejs.org/) v20 or later
- [Redis](https://www.redis.io/) v6 or later

## Environment variables

- `NODE_ENV`: `development` for local development or `production` for anything else
- `ENV`: name of the environment i.e. `staging` or `prod-eu`
- `IS_PRODUCTION`: disables verbose error responses, this flag can be set to `false` only for secure non-production
  environments
- `PORT`: application port

- `REDIS_HOST`: redis host
- `REDIS_PORT`: redis port
- `REDIS_DATABASE`: redis database number

- `LOG`: (optional) `gcp` for GCP logging or else for standard logging
- `LOG_LEVEL`: (optional, default `info`) Winston [log level](https://github.com/winstonjs/winston#logging-levels)

## Private NPM dependencies

NPM requires installing private `@slotify/shared` package. To have access to it you need to request private key. One of
the ways to configure it is to create `.npmrc` file with the following content where `XXX` should be replaced with
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

| Path           | Protocol     | Accessibility | Description    |
|----------------|--------------|---------------|----------------|
| `/websocket/*` | `WEBSOCKET ` | Public        | Websocket APIs |
| `/api/*`       | `HTTP/1.1`   | Cluster       | Internal APIs  |

## Health Check

`/health` returns:

- `OK` when everything works
- `QUITING` when process received `SIGTERM` signal

## Storage

No

## Scalability

The service is stateless, so it's ready for horizontal scaling.

## Licence

RNG is commercial module that is based on isaac.js open source library.
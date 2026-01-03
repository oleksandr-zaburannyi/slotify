# GDK package

GDK is Node application to make casino game development in an easy way

## Dependencies

- [Node](https://nodejs.org/) v16 or later

## Environment variables

- `NODE_ENV`: `development` for local development or `production` for anything else
- `IS_PRODUCTION`: disables cheats and verbose error responses, this flag can be set to `false` only for secure non-production environments
- `PORT`: application port
- `PROVIDER`: name of the provider
- `GAMES_PATH`: path to games
- `RNG`: path to RNG class
- `RNG_ALGORITHM`: name of the RNG algorithm (default: `isaac`)
- `RNG_LIMIT`: (GATI only) number of RNG numbers fetched in a single request to RNG service
- `RNG_POOL`: (GATI only) minimum number of RNG numbers pooled before each play request

- `LOG`: (optional) `gcp` for GCP logging or else for standard logging
- `LOG_LEVEL`: (optional, default `info`) Winston [log level](https://github.com/winstonjs/winston#logging-levels)

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
npm install @slotify/gdk
node node_modules/@slotify/gdk/lib/index.js
```

## Starting development

```shell script
ts-node-dev node_modules/@slotify/gdk/lib/index.js
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

| Path           | Protocol   | Accessibility | Description  |
|----------------|------------|---------------|--------------|
| `/api/games/*` | `HTTP/1.1` | Cluster       | Internal API |

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

No database

## Documentation

- [Game Server Development](docs/GAME_SERVER_DEVELOPMENT.md)

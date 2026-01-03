# Slotify RNG

Slotify RNG is a uses selected pseudo RNG algorithm to generate random numbers.

## Dependencies

- [Node](https://nodejs.org/) v12 or later

## Environment variables

- `NODE_ENV`: `development` for local development or `production` for anything else
- `ENV`: name of the environment i.e. `staging` or `prod-eu`
- `IS_PRODUCTION`: disables verbose error responses, this flag can be set to `false` only for secure non-production environments
- `PORT`: application port

- `LOG`: (optional) `gcp` for GCP logging or else for standard logging
- `LOG_LEVEL`: (optional, default `info`) Winston [log level](https://github.com/winstonjs/winston#logging-levels)

- `MAIL_HOST`: SMTP server host
- `MAIL_PORT`: SMTP server port
- `MAIL_USER`: e-mail user
- `MAIL_PASSWORD`: e-mail password
- `SLACK_WEBHOOK`: Slack webhook for alerting (https://api.slack.com/messaging/webhooks)

- `RNG_CYCLING_INTERVAL`: periodic cycling interval in milliseconds, default 10 minutes 
- `RNG_CYCLING_LIMIT`: maximum randomizations skipped
- `RNG_VERIFICATION_INTERVAL`: periodic chi test update interval in milliseconds, default 10 minutes
- `RNG_RESEEDING_INTERVAL`: time isaac is reseeded in milliseconds, default 24 hours

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

### Checksum verification

The script verified if the checksum changed compared to the certified one.

```shell
./checksums.js
```

## Building

```shell script
npm run build
```

## Routing

| Path     | Protocol   | Accessibility | Description   |
|----------|------------|---------------|---------------|
| `/api/*` | `HTTP/1.1` | Cluster       | Internal APIs |

## Health Check

`/health` returns:

- `OK` when everything works
- `QUITING` when process received `SIGTERM` signal

## Storage

No

## Scalability

The service is stateless, so it's ready for horizontal scaling.

## Documentation

- [RNG API](docs/RNG_API.md)

## Licence

RNG is commercial module that is based on isaac.js open source library.

### isaac.js is released under the [MIT Licence](http://www.opensource.org/licenses/MIT):

Copyright (c) 2012 Yves-Marie K. Rinquin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
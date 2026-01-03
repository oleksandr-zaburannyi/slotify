# Back Office

Back Office is SPA (Single Page Application) providing UI to manage other services.

## Dependencies

- [Node](https://nodejs.org/) v12 or later

## Environment variables

- `VITE_BO_API_URL`: public URL to adapter service
- `VITE_ENV`: (optional) name of the environment i.e. `staging` or `prod-eu`
- `VITE_NAME`: (optional) name of the Back Office owner
- `VITE_LOGO`: (optional) URL to logo in SVG
- `VITE_BASE_CURRENCY`: base currency (i.e. `eur`)

Back Office is frontend only so to pass environment variables you run the script (`./script/passEnvVariables.sh`) which bakes the variables into client code.

## Building

```shell script
npm ci --omit=dev
npm run build
```

## Running

Back office can run a simple HTTP server that exposes static files

```shell script
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

## Routing

| Path            | Protocol   | Accessibility | Description          |
|-----------------|------------|---------------|----------------------|
| `/backoffice/*` | `HTTP/1.1` | Public        | Serves static assets |

## Health Check

No

## Storage

No

## Scalability

The service is stateless, so it's ready for horizontal scaling.

## Database migration

No

## Documentation

- [Back Office Guidebook](docs/BACK_OFFICE_GUIDEBOOK.md)

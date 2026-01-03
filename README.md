# Slotify

_Slotify_ is a fast and lightweight online casino games provision solution.

> Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.
>
>_Antoine de Saint-Exupery_

## Quickstart

### How to run a local environment

Use `pm2` (https://pm2.keymetrics.io/) to run, test and experiment with Slotify Platform and Games on a local machine.
It runs postgres and redis docker images and starts platform services as concurrently tasks.

```
npm i pm2 -g # install pm2
pm2 start ecosystem.config.js
```

To run the script do the following:

1. install Docker desktop: https://docs.docker.com/desktop/install/mac-install/
2. install Node.js: (https://nodejs.org/en/download, or `brew install node` on macOS)
3. Install dependencies (`./scripts/install-dependencies.sh`), or run `npm ci` on each `slotify/*` folder
4. fetch currency exchange rates:
    + login http://localhost:8083/backoffice/login
    + go to Exchange Rates tab (http://localhost:8083/backoffice/currency-exchange-rates) and click on `Fetch` button
5. configure local platform at Back Office:
    + login http://localhost:8083/backoffice/login
    + go to wallets Configuration tab (http://localhost:8083/backoffice/wallets) and edit `demo` wallet address to `"url":"http://localhost:8088"`
    + got to Games tab (http://localhost:8083/backoffice/games) and add a `game` mapping to `provider` and `rgs`
6. restart the all processes (`pm2 restart all`) to apply all the changes to the local platform

**Note:** Do not delete any `package-lock.json` and always use `npm ci` to make sure it installs the expected dependencies version and not some untested/unsupported one.

## Documentation


- [Software Architecture](docs/SOFTWARE_ARCHITECTURE.md)

### Adapter

- [README](slotify/adapter/README.md)
- [Guidebook](slotify/adapter/docs/ADAPTER_GUIDEBOOK.md)
- [Wallet Integration](slotify/adapter/docs/WALLET_INTEGRATION.md)
- [RGS Integration](slotify/adapter/docs/RGS_INTEGRATION.md)
- [Back Office API](slotify/adapter/docs/BACK_OFFICE_API.md)
- [Wallet Integration Process](slotify/adapter/docs/WALLET_INTEGRATION_PROCESS.md)

### Back Office

- [README](slotify/back-office/README.md)
- [Guidebook](slotify/back-office/docs/BACK_OFFICE_GUIDEBOOK.md)

### Connector

- [README](slotify/connector/README.md)
- [Guidebook](slotify/connector/docs/CONNECTOR_GUIDEBOOK.md)
- [Game Client API](slotify/connector/docs/CONNECTOR_GAME_CLIENT_API.md)
- [Game Operator API](slotify/connector/docs/CONNECTOR_OPERATOR_API.md)

### Demo Casino

- [README](slotify/demo-casino/README.md)
- [Guidebook](slotify/demo-casino/docs/DEMO_CASINO_GUIDEBOOK.md)

### GDK

- [README](slotify/gdk/README.md)
- [Guidebook](slotify/gdk/docs/GAME_SERVER_DEVELOPMENT.md)

### Promo SDK

- [README](slotify/promo/README.md)
- [Integration](slotify/promo/docs/PROMO_INTEGRATION.md)
- [Tool Development](slotify/promo/docs/PROMO_TOOL_DEVELOPMENT.md)

### RGS

- [README](slotify/rgs/README.md)
- [Guidebook](slotify/rgs/docs/RGS_GUIDEBOOK.md)
- [Game Client Integration](slotify/rgs/docs/GAME_CLIENT_INTEGRATION.md)
- [Game Server Integration](slotify/rgs/docs/GAME_SERVER_INTEGRATION.md)
- [Game Integration Process](slotify/rgs/docs/GAME_INTEGRATION_PROCESS.md)

### RNG

- [README](slotify/rng/README.md)
- [API](slotify/rng/docs/RNG_API.md)

### Infrastructure as Code

- [README](ops/iac/gcp/README.md)
- [Infrastructure Architecture](ops/iac/gcp/docs/INFRASTRUCTURE_ARCHITECTURE.md)

### Load test

- [README](ops/load-test/README.md)
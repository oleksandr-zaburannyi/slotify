# Connector Library

This frontend library which:

- Implements Responsible Gaming measures such as Reality Check and Game History
- Market and operator specific configuration (spin time, autoplay availability etc.)
- Exposes postMessage API towards a casino website
- Simple and elegant RGS API enables easy Game Client integration
- Customisable branding
- Localised to 30 languages

## Import

```html

<script src="/slotify/connector/connector.js"></script>

<script>
    const connector = await window.connector.create(params, callbacks, theme);
</script>
```

## Start

```shell
npm start
```

## Build

```shell
npm run build
```

## Test

```shell
npm test
npm run lint
```

## Documentation

- [Connector Guidebook](docs/CONNECTOR_GUIDEBOOK.md)
- [Game Client API](docs/CONNECTOR_GAME_CLIENT_API.md)
- [Operator API](docs/CONNECTOR_OPERATOR_API.md)

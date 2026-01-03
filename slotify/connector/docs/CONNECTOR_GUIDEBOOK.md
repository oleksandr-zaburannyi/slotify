# Connector Guidebook

## Settings handling

Settings can be passed to the game via three level structure:

1. GET URL params i.e. `&some-param=123&another-param=456`
2. Connector initialisation `await window.connector.create(settings, callbacks, theme);`
3. Settings from RGS returned in `/game/info`

In case of repeated parameters higher point will overwrite previous values.

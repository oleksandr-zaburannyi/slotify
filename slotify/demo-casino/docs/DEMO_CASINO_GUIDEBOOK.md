# Demo Casino Guidebook

## Creating players

The trick to cheat the player on the demo wallet is to pass a key in this format:

```
{nativeId}:{balance}:{currency}:{jurisdiction}:{country}:{brand}:{nickname}
```

so for example will launch a player `my-native-id`

```
my-native-id:100:eur:uk:se:my-brand:my-nickname
```

or you can also skip some fields to create random player on my-brand with 100 eur

```
:100:eur:::my-brand
```

## Clearing old players

Due to potential large amount of anonymous players that can be created there is cron task which removes players created more than 48 hours ago.

## Delaying request in load testing

In the load testing you may want to simulate response time from external wallets. To achieve that you can set `REQUEST_DELAY` to delay all wallet responses
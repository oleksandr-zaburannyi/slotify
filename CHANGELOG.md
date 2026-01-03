# 17.12.2025

```
"adapter"     = "v3.4.21"
"back-office" = "v3.2.18"
"connector"   = "v2.2.10"
"demo-casino" = "v2.0.12"
"promo"       = "v2.1.12"
"rgs"         = "v4.1.19"
"rng"         = "v4.0.6"
"websocket"   = "v2.1.10"
```

```
"shared" = "v2.1.11"
"gdk" = "v4.2.4"
```

For production environments please run the following queries manually BEFORE deployment

```sql
alter table "adapter_transaction"
    add column if not exists "walletCampaignId" varchar;
alter table "adapter_transaction_archive"
    add column if not exists "walletCampaignId" varchar;
create index concurrently if not exists "adapter_transaction_walletCampaignId" on adapter_transaction ("walletCampaignId") where "walletCampaignId" is not null;

alter table "rgs_round"
    add column if not exists "completedAt" timestamptz;
alter table "rgs_round_archive"
    add column if not exists "completedAt" timestamptz;
create index concurrently if not exists "rgs_round_player_started_access" on rgs_round ("playerId", "provider", "game") where status = 'started';
create index concurrently if not exists "rgs_round_player_failed_access" on rgs_round ("playerId", "provider", "game", "failedAt") where status = 'failed';
create index concurrently if not exists "rgs_round_player_unpaid_access" on rgs_round ("playerId", "provider", "game", "completedAt") where status = 'unpaid';

create index concurrently if not exists "promo_stream_entry_processed_streamId_id" on promo_stream_entry ("processed", "streamId", "id") where processed = false;
create index concurrently if not exists "rgs_round_playerId_status_game_id" on rgs_round ("playerId", "status", "game", "id") where status IN ('started', 'unpaid');
```

- [promo] added wallet, operator, brand to free bets validation
- [adapter] fix wallet name in Relax free bets campaign
- [adapter] added possibility to customise `operator` in Reevo wallet
- [adapter] exposed audit logs retention to optional env variable `AUDIT_LOGS_RETENTION_DAYS`
- [adapter, promo, rgs, back-office] implement Free Bets API
- [rgs] fixed `/currencyDecimals` endpoint with custom min/max settings
- [rng] implement new certified RNG version 4.0 with periodic reseeding and cycling with external entropy
- [rgs] add `drawId` to multiplier replay responses
- [rgs] Fixed remote critical files checksums
- [adapter] added campaign details to SlotifyWallet
- [rgs] fix for infinite loop in `syncLeftmostBets`
- [rgs] change `calculateRtps` scheduled task to happen every hour
- [adapter] changed custom integrations to rely on `campaignData` instead of GraphQL call (fixing potential replica delay issue)
- [adapter] added an import option for Currency Aliases
- [websocket, rgs] added IP whitelisting for system messages in Multiplayer
- [adapter] added `currencyAliases` mapping to Qtech Wallet Adapter
- [rgs] added `completedAt` and `failedAt` to round for more precise retry expiry
- [promo] add `currency` param to jackpots campaign feed
- [adapter, back-office] added the ability to download and specify custom `timestamp` in Report Sender
- [rgs] fix RTP Monitoring showing outdated statistics for sample size `0`
- [rgs] make RTP Monitoring send alert emails from sample size `100`
- [adapter, infra] removed `ipgeolocation.io` Geo IP feed and Cloud Armor country blocking and replaced with native GCP GEO IP functionality
- [infra] removed `ip-blocked-countries`, `api-blocked-countries` and `geoip-blocked-states` and `ipgeolocation-api-key` from terraform variables
- [adapter, back-office] added ability to specify blocked countries and regions per wallet (warning: it is not backward compatible, please set up restricted territories using new system)
- [promo] implement jackpots base currency setting
- [infra] added option to define list of IPs excluded from rate limiting
- [adapter] fixed LnW player nativeId suffix and getrounds fetching for same player across different brands
- [adapter, back-office] added SFTP transport in Report Sender
- [adapter] added `/availableGames` endpoint to Standard Wallet REST API
- [adapter] fixed LnW free round popup options translation
- [adapter] added REST launch endpoint which returns launch URL
- [adapter] added `hostname` to Standard, Reevo and SoftSwiss2 wallets (used to force specific domain for launcher)
- [connector] added guard for not emit balance if its undefined (complete with asyncWin)
- [connector] add websocket close to the websocket api
- [adapter] added `currencyAliasesPerBrand` mapping to LnW and Standard Wallets
- [shared] excluding certain paths from metrics to improve memory usage for Prometheus
- [adapter] Added notification after editing an account
- [adapter, rgs] Introduced batching to archiving process
- [rgs, back-office] Ability to pay Draw Wins manually from the Back Office
- [connector] add deep copy of `_settings` object to proper handling more instances of connector
- [promo] prioritise campaign `start` time over `createdAt` in player campaigns visibility
- [rgs, back-office] add `promo` column to rgs Wager
- [adapter] Fixed `VND` free bets support in SoftSwiss2 Wallet Adapter
- [adapter] Added support for non-EUR base currency in the ECB feed
- [adapter, promo] implement DGE_jackpot report for transaction jackpots

# 30.10.2025

```
"adapter" = "v3.2.0"
"back-office" = "v3.2.0"
"connector" = "v2.2.0"
"demo-casino" = "v2.0.8"
"promo" = "v2.1.0"
"rgs" = "v4.1.0"
"rng" = "v3.0.8"
"websocket" = "v2.1.6"
```

```
"shared" = "v2.0.24"
"gdk" = "v4.0.10"
```

For production environments please run the following queries manually BEFORE deployment

```sql
create index concurrently if not exists rgs_round_status_pending on rgs_round ("createdAt", "playerId") include ("roundId") where status in ('started', 'finishing', 'unpaid');
create index concurrently if not exists rgs_round_status_cancelled on rgs_round ("failedAt", "playerId") include ("roundId") where status = 'cancelled';
create index concurrently if not exists "adapter_transaction_cancelledAt" on adapter_transaction ("cancelledAt") where "status" = 'cancelled';
create index concurrently if not exists "rgs_draw_finished_createdAt" on rgs_draw ("finished", "createdAt");
create index concurrently if not exists "promo_campaign_type_createdAt" on promo_campaign ("type", "createdAt");
create index concurrently if not exists "adapter_player_nativeId" ON adapter_player USING gin ("nativeId" gin_trgm_ops);
create index concurrently if not exists "rgs_command_roomId_id_unprocessed" ON rgs_command ("roomId", id) where processed is null;
create index concurrently if not exists "rgs_command_withdrawalStatus" ON rgs_command ("withdrawalStatus") where "withdrawalStatus" in ('failed', 'finishing');
create index concurrently if not exists "rgs_round_status_retry" ON rgs_round ("status") where "status" in ('failed', 'started', 'unpaid');
```

- `[rgs]` Add `roomId` argument to availableBets graphql query
- `[shared]` Fix in advisory lock to unlock after SIGTERM and have distinctive name
- `[rgs, connector]` Add `playerId` to authenticate response
- `[adapter, rgs]` Changed cube and archive tasks to run every 5 minutes with one minute of difference between each
- `[adapter]` Fixes in DGE NJ
- `[adapter, backoffice]` Add support for one-time key usage per wallet
- `[adapter, backoffice]` Added "Inspection" and "Game Win" fields to report exclusion, allowing exclusion by inspection, game win or both
- `[promo, adapter]` Add Free Bets `campaignData` to wallet transactions
- `[promo]` Add `campaignId`, `campaignType`, `campaignData` to deposit transaction if Free Bets campaign expired during the round
- `[adapter]` Added notification about account creation
- `[gdk]` Implement Transaction Jackpot RTP simulator feature to the RTP Simulator
- `[promo]` Add index to promo_campaign table for Backoffice campaigns type filtering
- `[adapter]` Added normalised RTP in Game Win reporting (it works only for new transactions!)
- `[adapter]` IMPORTANT: Added real IP white-listing for GraphQL account (previously it only prevented expiring tokens)
- `[rgs]` Added variant filter to Rooms
- `[infra]` Improved uptime alerts (removed duplicated alerts)
- `[infra]` Improvement reliability during cluster upgrades
- `[adapter]` Added `forceLanguage` to BadHombre Wallet to force social language for sweepstake
- `[rgs]` Make minBet conversion always rely on Fixed Rates
- `[infra]` Exposed `cluster-min-pods` (and changed default to `2`), `cluster-max-pods` and `cluster-node-pools` to terraform variables
- `[promo]` Added new campaign segmentation option based on player's currency
- `[rgs]` Added `settingId` for cross-env imports
- `[infra]` increased default machine type to `n2-highcpu-4` (WARNING: this will cause a cluster upgrade and short downtime)
- `[shared]` Added scheduler option to process multiple tasks in parallel
- `[adapter, back-office]` Ability to search for players with STARTS_WITH filter
- `[adapter, back-office]` Added exclusion reason field to reporting
- `[rgs]` Added permission validation for `checkSettings`, `availableBets` and `availableBetsBulk`
- `[promo]` Sending zero deposits for item prizes from campaigns
- `[promo]` Fixed tournament campaign main bet calculation bug
- `[adapter]` Alea API fixes
- `[rgs]` Added `syncLeftmostBets` to sync bets after min bet filter on main bet
- `[rgs]` Added `minDecimals` to force minimal number of decimals per currency

# 18.09.2025

```
"adapter" = "v3.1.33"
"promo" = "v2.0.11"
"demo-casino" = "v2.0.5"
"back-office" = "v3.1.9"
"rgs" = "v4.0.27"
"websocket" = "v2.1.3"
"rng" = "v3.0.5"
"connector" = "v2.1.20"
```

```
"shared" = "v2.0.24"
"gdk" = "v4.0.10"
```

For production environments please run the following queries manually BEFORE deployment

```sql
create index concurrently if not exists "adapter_transaction_sessionId" on adapter_transaction ("sessionId");
```

- `[infra]` Added `prometheus-scrape-interval` variable to configure scrape interval
- `[rgs]` Added `variant` to multiplayer games (room name)
- `[adapter, back-office]` Added Reset Wallet Inspection feature
- `[adapter]` Alea Wallet fixes from QA
- `[adapter]` Qtech Wallet fixes (urlencode on the balance call and fix for sidebets)
- `[infra, adapter, backoffice, demo-casino, promo, rgs, rng, websocket, shared]` Fixed a high CPU usage due to the latest prometheus metrics

# 05.09.2025

```
"adapter" = "v3.1.24"
"promo" = "v3.1.24"
"demo-casino" = "v3.1.24"
"back-office" = "v3.1.24"
"rgs" = "v3.1.24"
"websocket" = "v3.1.24"
"rng" = "v3.1.24"
"connector" = "v3.1.24"
```

```
"shared" = "v2.0.9"
"gdk" = "v2.0.9"
```

- `[adapter]` Fixed campaigns integration in Light & Wonder
- `[connector]` Added `hideCurrencySymbol` setting to hide currency symbol in default formatter
- `[adapter]` Fixed `getSupportedCurrencies` to check supported currency based on exchange rates
- `[connector, rgs]` added setting to split in authenticate call `currency` and `currencySymbol`
- `[rgs]` Optimised failed and cancelled commands fetching
- `[adapter]` Softswiss - do not cancel free bets transactions
- `[rgs, websocket, gdk]` Implement system commands for multiplayer games
- `[connector]` Added a new param to `getCampaigns` call for fetching translations explicitly
- `[connector]` Added a new method `getActiveCampaignsInfo` which exposes the details visible on the UI for each type of promo
- `[connector, promo]` Updated translations for improved clarity and fix some variable names
- `[connector, rgs, adapter]` Added "balance before" in game history
- `[adapter]` Added "SMCVenezuela" currency feed for unofficial VES rate (mapped to `ves2`)
- `[promo, connector]` Added `defaultCampaignThemeName` setting
- `[adapter]` Improved Graphql stitching to avoid one fault service from affecting others
- `[infra]` Added dashboards built on Prometheus metrics, deleted old log-based metrics
- `[rgs]` Increased JWT token expiration to 14 days
- `[adapter]` Replaced legacy player/wallet exclusion with unified report exclusion system
- `[shared, rng, gdk, promo, demo-casino, websocket, rgs, adapter, backoffice, connector]` Upgraded Express to v5, Redis to v4, removed `express-async-errors`, updated `cron-parser`
- `[shared, rng, gdk, promo, demo-casino, websocket, rgs, adapter, backoffice, connector]` Updated ESLint config to new format
- `[adapter, demo-casino]` Tweaked Express v5 API handlers and request body handling
- `[rgs, promo, adapter]` Fixed migrations to comply with TypeORM 0.3.23 (disallow empty objects in `delete`/`update`)
- `[promo, adapter]` Improved Redis/test cleanup and scheduled task handling during tests
- `[adapter]` Adjusted Express v5 path syntax for RGS endpoints
- `[rgs]` Updated API tests to reflect Express v5 error handling (`SERVER_ERROR` on non-`Exception`)
- `[backoffice]` Refactored styles (antd/styled-components/less) and updated graphiql logic/styles
- `[shared, adapter]` Replaced `moment` with `luxon`
- `[gdk]` **BREAKING CHANGE**: CLI options changed (`dump -ia` → `dump --ia`, `stats -pf` → `stats --pf`) due to `commander` update
- `[adapter]` Alea - wallet integration
- `[adapter]` Bad Hombre - fix for filtering disabled games
- `[back-office, adapter]` Made `query`, `variables` and `results` searchable in AuditLogs in the Back Office
- `[rgs, adapter, promo, shared]` Refactored add and import mutations to leave trace of ID
- `[websocket, connector]` Fixed websocket server to properly close unauthorized connections
- `[websocket, connector]` Added ping/pong keepalive system for multiplayer connections
- `[connector]` Added `closePromoOptOut` to replace "Opt out" button with "Close" button

## 22.07.2025

```
"adapter" = "v2.11.1"
"promo" = "v1.8.2"
"demo-casino" = "v1.5.2"
"back-office" = "v2.9.3"
"rgs" = "v3.11.1"
"websocket" = "v1.2.2"
"rng" = "v2.2.2"
"connector" = "v1.20.2"
```

```
"shared" = "v1.18.21"
"gdk" = "v3.8.2"
```

- `[adapter]` Refreshing Game Win report every 5 minutes
- `[rgs, adapter]` GraphQL operations with `Game` and `Setting` validate permissions
- `[rgs, adapter, connector]` Added custom error message for not available currency
- `[rng]` Added rate-limiting to `/updateClientSeed` endpoint
- `[adapter]` changed replay path in BadHombre
- `[rgs]` Included currency symbol instead of currency name in currencyDecimals endpoint
- `[all]` Migrated from `node-fetch` to `undici` in `shared` and updated all dependent projects accordingly
- `[all]` Upgraded Node.js version on dockers to node:24-slim
- `[all]` Fixed all known vulnerabilities in npm dependencies
- `[adapter]` Delayed Relax initial rollback by 1 minute
- `[adapter]` Add multiple domains support via `${hostname}` urls template parameter
- `[adapter]` SoftSwiss - changed `event_type` in promo calls
- `[adapter]` SoftSwiss - fix for canceling campaign during player session
- `[adapter]` Added `category` to test transactions in wallet verifier
- `[adapter]` Added player data to big win alert
- `[connector]` Prevent PromoUi modal from scrolling whole page while opened
- `[rgs]` Added drawId to multiplayer game history
- `[infra]` Added support for scraping Prometheus metrics
- `[rgs, adapter, gdk, promo, rng, websocket]` added Prometheus metrics
- `[rgs, gdk]` Added `IBetLimits` to multiplayer commands in ticks
- `[promo, back-office]` add `manageThemes` permission to back-office user
- `[connector]` Improved locale code normalisation to better handle language variants
- `[connector, shared, websocket]` Implemented optional basic API encryption
- `[adapter, shared]` Validate cron expressions for Report Senders
- `[adapter]` Fixed canceling Relax free bets campaign
- `[promo]` Improved Leaderboard scalability
- `[connector]` Always show campaign popups on start for active campaigns
- `[connector]` Fixed Playtech Client API integration to satisfy requirements

## 09.06.2025

```
"adapter" = "v2.10.0"
"promo" = "v1.7.0"
"demo-casino" = "v1.4.0"
"back-office" = "v2.8.11"
"rgs" = "v3.10.0"
"websocket" = "v1.1.0"
"rng" = "v2.1.27"
"connector" = "v1.19.0"
```

```
"shared" = "v1.16.14"
"gdk" = "v3.7.0"
```

- `[rgs, adapter, shared]` Added queue to prevent parallel transactions per wallet
- `[shared]` Fixed links in Slack notifications
- `[connector]` Added `parallelRound` param to play function to signal that parallel rounds are expected
- `[promo]` Fixes to `en_SC` language in promo tools T&S
- `[adapter, back-office]` Reverted `SESSION_EXPIRED` error code for Back office session (from `ACCOUNT_SESSION_EXPIRED`)
- `[adapter]` PinUp Wallet Adapter implementation
- `[adapter]` Add `replayurl` to Relax wallet adapter deposits and finalize rounds (for PokerStars integration)
- `[adapter]` updated Future Anthem API
- `[infra]` exposed `cluster-initial-node-count` to terraform variables
- `[rgs]` add filtering multiplayer rooms with unfinished hash chain
- `[shared, adapter, rgs, promo]` fix scheduler leftover tasks with no data
- `[shared, adapter, rgs, promo]` make scheduler require task data to be provided
- `[connector]` Updated Playtech Client API integration to satisfy all requirements
- `[websocket]` Improved logging of websocket messaging
- `[rgs]` Removed `finishing` round state in favour of Redis lock
- `[adapter]` Added extra safeguard not to cancel withdrawals if there are deposits on the same round
- `[shared]` Removed error stack from GraphQL errors
- `[backoffice]` Fixed `DATE` filter in `DataTable` to properly handle UTC conversion for both start and end dates
- `[infra]` Ability to disable security policy (Cloud Armor)
- `[adapter]` Fixed error codes in Grr (from numbers to strings)
- `[rgs]` Rehydrating retries to redis every hour instead of on startup
- `[adapter]` Changed Reevo `operator` to `reevo` instead of brand
- `[adapter]` Added `channel` to authentication call in Standard Wallet Adapter
- `[connector]` Add `overlayBackgroundColor` theme option
- `[adapter]` Relax wallet adapter - add `IP_BLOCKED` error message
- `[adapter]` Relax wallet adapter - add legacy `rcenable`, `rciframeurl` url params mapping

## 24.04.2025

```
"adapter" = "v2.9.0"
"promo" = "v1.6.0"
"demo-casino" = "v1.3.17"
"back-office" = "v2.8.5"
"rgs" = "v3.9.9"
"websocket" = "v1.0.11"
"rng" = "v2.1.25"
"connector" = "v1.18.5"
```

```
"shared" = "v1.16.4"
"gdk" = "v3.6.5"
```

- `[adapter]` Reevo - changed key generation to calculate it post URL encoding
- `[connector]` Fixed displaying campaign header for `planned` campaigns
- `[shared]` Added support for TLS connection in Redis
- `[adapter, back-office]` Added game title to Game Win report
- `[connector, adapter, rgs]` Added custom error for game not being available
- `[infra]` Added support for multiple domains
- `[adapter]` Exposed `BLOCKED_TERRITORY` error in wallet adapter
- `[infra]` Increased default cluster disc size to 20GB
- `[adapter]` Made country optional in OpenBox wallet adapter
- `[promo, back-office, connector]` Added cash limit to bet multiplier prices in Prize Drop campaign
- `[promo, connector]` Made themed campaign rules render HTML content
- `[adapter]` Optimised wallet cache access for better performance
- `[connector]` Added `currencyDecimals` parameter to `callbacks.formatCurrency`
- `[adapter, back-office]` Added automated periodic report sender
- `[shared]` Added `DB_MIGRATIONS_RUN` environment variable that allows disabling migrations on service startup
- `[shared]` Added `runMigrations.ts` script to trigger service migrations manually
- `[adapter, rgs, gdk]` Implemented blocking players for parameters manipulation
- `[adapter]` Added bet to Big Win alerts
- `[infra]` Added `database-authorized-ips` with list of whitelisted IPs to connect to the database
- `[rgs, connector]` Exposed `currencyExchangeRates` endpoint for client applications
- `[promo, connector]` Added Bengali (`bn`) language
- `[shared]` Added `x-correlation-id` to scheduled tasks
- `[adapter]` Added support for `TRANSACTION_NOT_FOUND` error in Wallet Verifier
- `[shared]` Replaced `html-to-mrkdwn` with `node-html-markdown` for HTML to Markdown conversion
- `[adapter]` Improved handling of duplicated transactions in BetConstruct
- `[rgs]` Improved expiry handling for unfinished rounds in authenticate
- `[rgs, adapter]` Added DGE reports for New Jersey
- `[demo-casino]` Ability to force brand from a key
- `[rgs]` Added `availableCurrencies` GraphQL query
- `[gdk]` Added provably fair to GDK single player simulator
- `[adapter]` Added `useOriginalToken` to Standard Wallet Adapter
- `[promo]` Added scheduled tasks to promo and removed expensive campaign finishing query

## 13.03.2025

```
"adapter" = "v2.8.41"
"promo" = "v1.5.6"
"demo-casino" = "v1.3.13"
"back-office" = "v2.8.2"
"rgs" = "v3.7.5"
"websocket" = "v1.0.10"
"rng" = "v2.1.23"
"connector" = "v1.17.8"
```

```
"shared" = "v1.15.37"
"gdk" = "v3.5.3"
```

- `[rgs]` Fixed win flooring in replays and multiplayer
- `[rgs]` Added `roundId` to drawWin graphql endpoint
- `[gdk]` Added multiple game names registration
- `[gdk]` Added `coin` to stats simulator
- `[gdk]` Reverted `HitFrequency` to show value as "1 in Count"
- `[adapter]` SoftSwiss v2 API - support for multiple endpoints
- `[adapter]` QTech - added support for `maxBetAmount`
- `[adapter]` Grrr Wallet Adapter implementation
- `[infra, connector]` Added error message for territory block
- `[rgs, promo]` Added `roundId` UUID lowercase validation
- `[connector, promo]` Added `en_SC` language for sweepstake casinos
- `[shared]` Increased the body limit to 1mb for graphQL endpoint
- `[rgs]` Added `comment` to Settings import
- `[adapter, promo]` Added `campaignTypes` to StandardWallet authentication indicating which promo tools ara available for given player session
- `[rgs]` Fixed bug not passing session setting to the client
- `[adapter]` Bad Hombre Wallet Adapter implementation
- `[adapter]` Ability to disable IP and Geo IP blocking per wallet
- `[connector]` Separated translations from the main JS bundle, now outputting them as a standalone JSON file
- `[back-office]` Fixed data range on home page
- `[adapter, rgs, rng, promo]` Improved Account permissions
- `[adapter]` Added rate limit support to coinAPI feed
- `[connector]` Added `balanceChanged` and `refreshBalance` incoming messages to the Operator API
- `[adapter]` Added `availableGames` query
- `[rgs]` Fixed usage of `maxDecimals` for multiplayer
- `[rgs, back-office]` Added visibility over difference between Fixed Rate and Exchange Rate
- `[connector]` Added `showLobbyButton` public function that indicates if lobbyUrl exists
- `[gdk]` Fix validate sideBet argument
- `[promo]` Fix freeBets canceling transactions on wallet withdraw errors
- `[connector]` added language to `getReplayUrl`
- `[connector]` added betLimits to response from info endpoint
- `[connector]` Added `getChannel` public function that return channel value passed in URL params
- `[adapter]` added `ip` to authenticate and transaction in Standard Wallet Adapter
- `[adapter]` Fixed LnW auto complete call due to the missing channel parameter
- `[rgs, back-office]` Add `useExchangeRateBetLimits` setting
- `[rgs, gdk]` Add `BetLimits` argument to games `play`
- `[connector]` Update connector's Relax FEIM library

## 03.02.2025

```
"adapter" = "v2.7.46"
"promo" = "v1.5.1"
"demo-casino" = "v1.3.13"
"back-office" = "v2.7.2"
"rgs" = "v3.6.14"
"websocket" = "v1.0.10"
"rng" = "v2.1.20"
"connector" = "v1.17.4"
```

```
"shared" = "v1.15.29"
"gdk" = "v3.3.2"
```

- `[infra]` Updated missing env variables in on-prem
- `[infra]` Fixed websocket service in on-prem
- `[back-office]` Showing information about PROD vs. DEV environment in the header
- `[adapter]` Ability to anonymize IP addresses via terraform variable `anonymise-ips`
- `[rgs, shared]` Fixed scheduling instant tick
- `[adapter]` Fixed launch using wrong `config` when using `rgsConfig` in Game
- `[adapter]` Fixed coinLayer conversion rate
- `[adapter, promo, rgs, rng]` Skip installing Postgres extensions on replicas
- `[adapter]` Moved end session to Redis scheduler
- `[promo, back-office, connector]` Add promo tools Themes and Translations feature
- `[adapter, rgs, connector]` Implement Swedish regulatory time limits for Relax wallet
- `[adapter]` Removed `insecure-http-parser` flag
- `[adapter]` Removed `api/cube` and `api/archive` endpoints
- `[connector]` Added `roundId` to `recover`
- `[adapter]` Added `slotify` wallet adapter used to chain multiple Slotify instance
- `[adaper]` Added games mapping in L&W wallet adapter for critical files endpoint
- `[adaper]` Implement mapping Relax currencies (GC.) into multiple fixed rates with different multipliers
- `[adaper]` Remove Relax language mapping from adapter so translations get resolved on Connector level
- `[back-office]` added searching Themes by name
- `[back-office]` added `CANCEL_TRANSACTION` error code

## 18.12.2024

```
"adapter" = "v2.7.35"
"promo" = "v1.4.21"
"demo-casino" = "v1.3.13"
"back-office" = "v2.6.9"
"rgs" = "v3.6.7"
"websocket" = "v1.0.10"
"rng" = "v2.1.19"
"connector" = "v1.16.12"
```

```
"shared" = "v1.15.23"
"gdk" = "v3.3.2"
```

- `[adapter]` L&W Adapter fix for reality check (converting seconds into minutes)
- `[rgs]` fix gameVariant not being passed as server only setting

## 16.12.2024

```
"adapter" = "v2.7.34"
"promo" = "v1.4.21"
"demo-casino" = "v1.3.13"
"back-office" = "v2.6.8"
"rgs" = "v3.6.5"
"websocket" = "v1.0.10"
"rng" = "v2.1.19"
"connector" = "v1.16.12"
```

```
"shared" = "v1.15.22"
"gdk" = "v3.3.2"
```

For production environments please run the following queries manually BEFORE deployment

```sql
create unique index concurrently if not exists "rgs_round_prevRoundId" on rgs_round ("prevRoundId") where "prevRoundId" IS NOT NULL and "createdAt" > '2024-XX-XX'; --please fill with todays date
```

- `[promo, back-office]` Added ability to clear "Opt out" decision of a player
- `[connector]` Added `hidePromoOptOut` setting to remove "Opt out" button from Promo UI
- `[promo, back-office, connector]` Added Bet Multiplier prize to Prize Drop campaign
- `[adapter]` Updated fun mode flow in Jogo RGS
- `[promo, back-office]` Fixed `undefined` currency in Promo Tools Back Office
- `[shared]` Fixed win flooring algorithm to support huge values
- `[rgs]` Prevent blocking system due to lack of critical file checksum response
- `[rgs]` Reverted `gameEnabled` setting
- `[connector]` Display free bets UI on restore
- `[rng]` Change activeRngSeeds to represent the next round's nonce - i.e. amount of rounds played
- `[shared]` Added `Cache-Control` and `keep-alive` header to fix stalling browser request
- `[adapter]` Increased graphQL performace due to schema caching
- `[connector]` Added `balanceChanged` callback
- `[connector]` Refreshing balance after prize drop prize
- `[adapter]` Added blocking by state based on GEO IP feed (https://ipgeolocation.io/)
- `[back-office]` Displaying current leaderboard table in Tournament tool
- `[shared, adapter, back-office]` Ability to see excluded and not excluded players and wallets in Game Win report
- `[shared]` Added limit of 1000 characters to be logged for request and response

## 05.11.2024

```
"adapter" = "v2.7.21"
"promo" = "v1.4.18"
"demo-casino" = "v1.3.10"
"back-office" = "v2.6.4"
"rgs" = "v3.5.31"
"websocket" = "v1.0.9"
"rng" = "v2.1.12"
"connector" = "v1.16.6"
```

BEFORE deploying the latest changes, please run the following command to update terraform providers:

```shell
terraform init -upgrade
```

- `[rgs]` Added `mainBets` setting to disconnect i.e. ante bet from `maxBonusBet` setting
- `[rgs]` support for multiple parallel rounds
- `[rgs]` support for async wins
- `[rgs]` performance improvements
- `[gdk]` Made `tick` and `init` asynchronous
- `[back-office]` Fixed filtering by type in Campaigns page
- `[all]` Enforcing HTTPS via `Strict-Transport-Security` header (can be disabled with terraform variable `allow-http` set to `true`)
- `[all]` Added `X-Content-Type-Options` header set to `nosniff`
- `[adapter, back-office]` Added `rgsTransactionId` to the Back Office and `rgsRoundId` to both Back Office and database
- `[adapter, back-office]` Added ability to overwrite RGS config per game with `rgsConfig`
- `[rgs]` fixed fun mode empty key in Jogo RGS
- `[adapter]` fixed error handling when no `msg` field is passed on in Reevo wallet integration
- `[rgs, connector]` Added `balance` method to fetch the latest player's balance
- `[connector]` added `openDeposit` and `isDepositSupported` methods
- `[adapter]` fixed `operatorbetsettings` in Relax integration
- `[promo]` added `name` to Campaign prize payout request
- `[infra]` updated terraform providers to the latest versions and changed version policy to only upgrade providers between major versions
- `[adapter]` updated JOGO integration error code report
- `[rng, rgs, gdk, connector, back-office]` implement Provably Fair Multiplayer
- `[adapter]` fixed session validation in JOGO RGS
- `[infra]` set `/bin/bash` as the interpreter in `local-exec` provisioners

## 09.10.2024

```
"adapter" = "v2.7.16"
"promo" = "v1.4.17"
"demo-casino" = "v1.3.8"
"back-office" = "v2.5.22"
"rgs" = "v3.4.0"
"websocket" = "v1.0.9"
"rng" = "v2.0.0"
"connector" = "v1.15.9"
```

```
"shared" = "v1.15.6"
"gdk" = "v3.0.8"
```

- `[promo]` leaderboard tool
- `[infra]` improved uptime alert
- `[infra]` added alert for CPU consumption above 80% on primary DB
- `[back-office]` fixed Game Win form view on mobile
- `[rgs, connector]` added support for min/max bet per room
- `[adapter]` adding/editing currency alias updates exchange rates immediately
- `[rgs, back-office, infra]` support for decimal places per currency
- `[rgs]` support for more than 2 decimal places
- `[connector]` fixed Reality Check Game History in Relax to open in the new tab
- `[rgs]` supporting `defaultBet` from session data object
- `[adapter]` setting default config in Playtech Wallet adapter
- `[adapter]` SoftSwiss v2 Wallet Adapter
- `[gdk]` added `refreshInterval` to control stats computation frequency or switch it off
- `[all]` added optional code obfuscation in Docker images
- `[demo-casino]` added db transactions to balance changes
- `[adapter]` added `rng` object and `category` in `getgames` call for Denmark
- `[rgs, connector]` add `currencyDecimals` service and expose `floor` method in Connector
- `[adapter]` fixed ip field in Jogo RGS
- `[promo]` update `rng` to 2.0.0 in promo service
- `[rgs]` improved handling of corner cases in auto complete scheduler
- `[adapter]` fix Relax free rounds campaign finished mechanics
- `[connector]` added `skipReplayMode` in `gameHistory` method
- `[rgs, back-office]` added comment field to Settings

## 19.08.2024

```
"adapter" = "v2.7.0"
"promo" = "v1.4.10"
"demo-casino" = "v1.3.6"
"back-office" = "v2.5.15"
"rgs" = "v3.3.1"
"websocket" = "v1.0.6"
"rng" = "v2.0.0"
"connector" = "v1.15.0"
```

```
"shared" = "v1.15.0"
"gdk" = "v3.0.0"
```

For production environments please run the following queries manually BEFORE deployment

- they can take 30+ minutes
- run it in sequence (one after another only when previous one finished succesfully)

```sql
create index concurrently if not exists "rgs_round_status_createdAt_active" on rgs_round ("status", "createdAt", "active") where status not in ('force-index-scan');
drop index concurrently if exists "rgs_round_status_createdAt";
create index concurrently if not exists "adapter_sessions_active_endedAt" on adapter_session ("active", "endedAt") where active IS NOT TRUE;
create index concurrently if not exists "rgs_round_playerId_game_id_desc" on rgs_round ("playerId", game, id DESC);
drop index concurrently if exists "rgs_round_playerId_game_id";
create index concurrently if not exists "adapter_player_wallet" ON adapter_player ("wallet");
```

- `[back-office]` Fixed editing Currency Alias
- `[connector]` Playtech Client API ("pause", "autoplay", "balanceupdate")
- `[connector]` Added `getReplayUrl` method and exposed `roundId` in `play()`
- `[infra]` Upgraded Postgres to 16 (important: please read section on [Upgrading database in README](ops/iac/gcp/README.md#upgrading-database))
- `[adapter]` Fixes to free bets currency in BetContruct, Slotegrator and Reevo
- `[rgs, adapter, shared]` Added cache invalidation after data changes in Back Office
- `[adapter, connector]` Added Light & Wonder wallet integration
- `[adapter]` Refactor error codes for wallet integrations
- `[adapter]` Reevo - fixes after their testing
- `[shared]` Added `version/all` endpoint
- `[adapter]` changed default BetConstruct timeout to 3 (as advised by them)
- `[adapter]` Ability to cache authentication response based on the same `key`
- `[shared]` Added advisory lock to migrations so they are not run in parallel
- `[adapter, back-office]` Ability to exclude wallets from reporting (and renamed `test` players to `excluded`)
- `[infra]` Exposed rate limitting configution to terraform variables
- `[demo-casino]` Ability to cheat player's country
- `[infra]` Excluded `/feed`, `/wallet` and `/rgs` from rate limitting
- `[rgs]` Added `winCap` setting to cap wins to fixed monetary value
- `[adapter]` Removed `autoDeposit` and `autoCancel`
- `[adapter]` Added Express request param to launcher
- `[gdk]` Support for multiline stats
- `[rgs]` Introduced new retry mechanism
- `[rgs, back-office]` Ability to close round manually from the Back Office
- `[infra, adapter, rgs]` Removed CRON tasks
- `[rgs]` Deprecated `autoCompleteExpiry` in favour of `autoCompleteDisabled` and `retriesExpiryHours` (default is now 72 hours!)
- `[adapter]` Slotegrator - added immediate retries and changed `amount` from string to float
- `[connector]` Added `SESSION_EXPIRED` custom error message
- `[adapter, back-office]` Added ability to trigger currency fetching from the Back Office
- `[adapter, back-office]` Added raw query to audit logs
- `[promo]` Fixed caching active campaigns per game
- `[adapter, connector]` implement Relax integration for Pokerstars
- `[adapter, connector]` update Relax integration retries mechanism
- `[rgs]` remove multiple withdrawals command guard index for multiplier games
- `[gdk]` rework `action` and `simulate` API to support multi-step games with `params` and `sideBets`
- `[gdk]` change RTP Statistics to support side bets strategy games

## 01.07.2024

```
"adapter" = "v2.6.24"
"promo" = "v1.4.7"
"demo-casino" = "v1.3.4"
"back-office" = "v2.5.11"
"rgs" = "v3.2.0"
"websocket" = "v1.0.5"
"rng" = "v2.0.0"
"connector" = "v1.14.0"
```

```
"shared" = "v1.14.4"
"gdk" = "v2.1.0"
```

- `[gdk, rgs, connector]` Changed `available` bets format to enable `min`/`max`/`step` instead of listing all available bets
- `[infra]` introduced Redis
- `[gdk, rgs]` Multiplayer BETA
- `[infra]` Exclude `/graphql` and `/backoffice` from IP country blocking
- `[back-office]` Prevent swipe back geasture in the Back Office
- `[connector]` Fixed translation for `restoreTitle` key in resources.json file
- `[back-office]` Prevent accidental space in some inputs related to ID's
- `[rgs, adapter]` Ability to support zero bets
- `[rgs, connector]` Ability to automatically collect round without sending separate complete request
- `[adapter, back-office]` Hide sections which are not available due to not having certain services
- `[connector]` Repalced "later" with "opt out" button in initial promo campaigns
- `[connector]` Fixed bug with carousel becoming empty after campain is finished
- `[adapter, rgs, promo, shared]` Replaced hardcoded service URLs with `getServiceUrl`
- `[adapter]` Making `roundId` unique across multiple RGS's
- `[adapter]` Fix of free bets campaign finishing during promo module unavailability
- `[infra]` Fail connector deployment if Docker is not running
- `[adapter]` Fix for getting last result from `TransactionCube`
- `[adapter, back-office]` Games management respect `rgs` account limitations
- `[adapter, back-office, connector, demo-casino, gdk, promo, rgs, rng, shared, websocket]` Added prettier to standardise the code style
- `[adapter]` Removed `getAvailableBets` call in favour of `getAvailableBetsBulk`
- `[adapter]` Added new CoinLayer currency feed
- `[adapter]` Support for currency alias with `0` rate
- `[connector]` Added progress report to `gameLoaded` method
- `[rng, rgs, back-office]` Added support for Provably Fair
- `[adapter]` Increased Audit Logs retention to 365 days
- `[adapter, rgs, connector]` Add support for popups in authenticate call
- `[adapter]` Improvents for cube generation
- `[connector]` Added new methods to handle support for mute, turbo, paytable, help and about game features
- `[adapter]` Playtech - added support for maxAllowedBetAmt and passing `jurisdiction` to demo wallet
- `[connector]` Fixed bug with campaign finished popups duplicating when it expires during the spin
- `[connector]` Fixed Tournament prize showing in base currency on campaign finished popup
- `[rgs]` Add validation for Fixed Currency Rates to be integers greater then 0

## 15.05.2024

```
"adapter" = "v2.6.0"
"promo" = "v1.4.7"
"demo-casino" = "v1.3.4"
"back-office" = "v2.4.3"
"rgs" = "v2.4.12"
"rng" = "v1.3.1"
"connector" = "v1.10.0"
```

```
"shared" = "v1.11.13"
"gdk" = "v1.7.5"
```

- `[adapter]` Updated wallet integration documentation with error codes and `refreshUrl`
- `[adapter]` Added Jogo Global RGS integration
- `[connector]` Fixed number of total prizes in Tournament UI
- `[connector]` Fixed max delay in setTimeout
- `[connector]` Fixed bug with freezing popups due to animation
- `[demo-casino]` Fixed cheats for player's balance
- `[rng]` Changed `range` to `randomInteger` method with unbiased implementation
- `[back-office]` Ability to regenerate GameWin
- `[back-office]` Fixed visibility of "Edit player" button
- `[adapter, back-office]` Added `jurisdiction` to Game Win, Transactions and Round views
- `[back-office]` Fixed fetching wagers and round data for external RGS's
- `[adapter]` Added retries to CoinAPI feed
- `[connector]` Added `exitTarget` setting to define target of redirection in `connector.exit` function
- `[adapter]` Slotegrator custom integration
- `[adapter]` Reevo custom integration
- `[adapter]` QTech custom integration
- `[adapter]` FizzyBubbly (N2) custom integration
- `[adapter]` BetConstruct custom integration
- `[adapter]` Removed `ppc` currency from CoinAPI feed (not supported anymore)
- `[adapter]` Added `winRatio` as a wins/bets to alerts
- `[connector]` Fix Connector making calls to campaigns service every spin after all campaigns acknowledged
- `[adapter]` Repeat only for `UNKNOWN` errors in Standard Wallet adapter and added `TRANSACTION_NOT_FOUND` error code
- `[connector]` Updated locales to use [BCP 47](https://en.wikipedia.org/wiki/IETF_language_tag) standard
- `[gdk]` Make Random Numbers Generator to be passed as game methods argument
- `[gdk]` remove deprecated rng adapters
- `[rng]` remove deprecated xorshift and math RNG_ALGORITHMS

## 15.03.2024

```
"adapter" = "v2.5.23"
"promo" = "v1.4.7"
"demo-casino" = "v1.3.3"
"back-office" = "v2.4.1"
"rgs" = "v2.4.11"
"rng" = "v1.1.10"
"connector" = "v1.9.11"
```

```
"shared" = "v1.11.11"
"gdk" = "v1.6.4"
```

- `[back-office]` Ability to save verifiers results to PDF
- `[rgs]` Improved error handling during auto complete
- `[shared, rng, rgs, adapter]` Added Slack webhook for alerting (https://api.slack.com/messaging/webhooks)
- `[adapter]` Removed `internalSecretKey` from Playtech Wallet config
- `[adapter, back-office]` Added group on players for reporting purpose
- `[adapter]` Fixed `transactionId` in wallet verifier for an idempotence test case
- `[connector]` Add `freeze` and `unfreeze` callbacks
- `[connector]` Prevent spacebar from opening terms and conditions
- `[infra]` Migrated to `HPAv2` (v1 was deprecated)
- `[adapter, back-office]` Added Currency Feed management via Back Office
- `[adapter]` Added new ECB currency feed
- `[adapter, back-office]` Added ability to manually manage Currency Exchange Rates
- `[connector]` fix promo campaign popups on Windows
- `[adapter, rgs, connector]` Playtech support for CMA popup and Reality Check popup
- `[promo]` Handling campaign expiry during player session
- `[shared]` Added custom TypeORM logger
- `[promo, connector, back-office]` Added option for empty prize in a Tournament
- `[rgs, adapter]` Added `bluelytics` feed and `arsblue` support
- `[rgs, promo, adapter]` Optimised queries with indexes
- `[connector]` Reworked promo header and replaced `setPromoPosition` with `setPromoUI`
- `[adapter]` Extended limit for Game Win report rows via API to 100k

## 13.02.2024

```
"adapter" = "v2.5.0"
"promo" = "v1.4.5"
"demo-casino" = "v1.3.2"
"back-office" = "v2.3.10"
"rgs" = "v2.4.0"
"rng" = "v1.1.8"
"connector" = "v1.9.0"
```

```
"shared" = "v1.11.4"
"gdk" = "v1.6.4"
```

- `[adapter, rgs, promo, rng, demo-casino, gdk]` Rework Exceptions
- `[adapter, connector]` Relax fixes
- `[adapter]` Playtech fixes
- `[adapter, infra]` Changed `adapter2` to `adapter-graphql` and made clear separation from main `adapter`
- `[rgs]` Added `previousState` to `/replay` and `/recover`
- `[promo]` Significantly improved campaign fetching speed with new db indexes
- `[adapter, rgs]` Added automated data archiving process
- `[gdk]` Fixed importing RNG in simulator
- `[connector]` Cleaned up types and documentation
- `[adapter]` Fixed importing `rgsCode` in Games
- `[adapter, rgs, gdk]` Add `regulatory` information to support Portuguese regulation
- `[adapter]` Added `lyn` currency (Libyan dinar)
- `[adapter]` Added `balance` in transaction event in Future Anthem integration
- `[adapter, connector]` implement missing RelaxWalletAdapter functionalities
- `[connector]` add `formatCurrency` callback for custom currency formatting
- `[adapter]` Playtech CMA popup fix

## 09.01.2024

```
"adapter" = "v2.4.11"
"promo" = "v1.4.3"
"demo-casino" = "v1.3.0"
"back-office" = "v2.3.9"
"rgs" = "v2.3.6"
"rng" = "v1.1.6"
"connector" = "v1.8.13"
```

```
"shared" = "v1.10.5"
"gdk" = "v1.6.0"
```

- `[infra]` Updated terraform providers (run `terraform init -upgrade`)
- `[back-office]` Updated to React 18 and Vite
- `[connector]` Updated to React 18 and Vite
- `[all]` Updated dependencies
- `[connector]` fix tournament rules page
- `[shared, back-office]` support for JSON types in CSV
- `[shared]` removed Google Cloud Trace agent
- `[shared]` added `/health/all` to check health of all services for uptime checks
- `[adapter]` exposed session data (i.e. bet configuration) in Standard Wallet Adapter
- `[connector]` Exposed type definition
- `[adapter, back-office]` Added group property to wallets
- `[adapter, back-office]` Added RGS game to avoid potential conflicts in game codes
- `[adapter, infra]` Future Anthem API changes
- `[adapter, infra]` Various performance improvements
- `[adapter, connector]` Implement RelaxWalletAdapter integration
- `[connector]` implement possibility to change connector's Header position
- `[promo]` Tournament - option to exclude non-main bets
- `[adapter]` Playtech fixes
- `[adapter]` Fixed handling errors during verification rejecting transactions
- `[connector]` Exposed `settings` in replay
- `[connector]` Ability to change font theme colors
- `[adapter]` Fixed IWalletAdapter.IWalletAutehnticate typo (backwards incompatibility for custom integrations)
- `[adapter]` make `IWalletTransaction` carry all fields from ITransactions and add `createdAt` field
- `[adapter]` make `provider?` field optional in `ITransaction`/`IWalletTransaction` interfaces for promo tool payouts
  not related to any game (backwards incompatibility for custom integrations)
- `[connector]` add Reality Check Elapsed parameter to connector's url settings
- `[adapter]` locking Game Win regeneration so only one can happen at the same time

## 05.12.2023

```
"adapter" = "v2.2.0"
"promo" = "v1.4.0"
"demo-casino" = "v1.2.3"
"back-office" = "v2.2.2"
"rgs" = "v2.2.9"
"rng" = "v1.1.4"
"connector" = "v1.7.0"
```

```
"shared" = "v1.7.1"
"gdk" = "v1.5.1"
```

- `[infra]` Excluded `/graphql` from rate limitting
- `[adapter]` Playtech fixes
- `[adapter, back-office]` New round inspection tool
- `[adapter]` Added db index on `token` in `adapter_session` table
- `[infra]` SMS and email notification about downtime (remember to verify phone numbers)
- `[rgs]` Added round auto expiry to auto cancels
- `[rgs]` Exposed `/api/autoCompleteRound` endpoint
- `[adapter]` Fail creating a new account if email is not sent successfully
- `[promo, backoffice, connector]` Implement Tournament promo campaign
- `[adapter]` Added missing fields in Game import
- `[shared]` Removed `NULLS LAST` in grapqhl API to improve performance
- `[rng]` Implemented background cycling
- `[rgs, gdk]` Side bet and custom bet validation
- `[shared]` Import CSV accepts formats with `"` and without
- `[back-office]` Added Currency Exchange Rate to a Game Win report

## 07.11.2023

```
"adapter" = "v2.1.22"
"promo" = "v1.3.3"
"demo-casino" = "v1.2.3"
"back-office" = "v2.1.4"
"rgs" = "v2.2.1"
"rng" = "v1.1.3"
"connector" = "v1.6.1"
```

```
"shared" = "v1.7.1"
"gdk" = "v1.5.1"
```

- `[adapeter]` Moved endSession after error on wallet level
- `[adapeter, rgs, connector]` Playtech fixes
- `[adapeter, infra]` Future Anthem integration
- `[rgs, gdk, connector]` Implement game Feed feature
- `[gdk]` add Partial RTP statistics feature
- `[promo]` fixed promo popups

## 31.10.2023

```
"adapter" = "v2.1.14"
"promo" = "v1.3.3"
"demo-casino" = "v1.2.3"
"back-office" = "v2.1.4"
"rgs" = "v2.1.6"
"rng" = "v1.1.3"
"connector" = "v1.5.1"
```

```
"shared" = "v1.7.1"
"gdk" = "v1.4.2"
```

- `[promo]` Removed `autoOptIn` and moved it on the code level
- `[rgs]` Repeat pending cancels on authentication and prevent from playing in case of pending failed round
- `[adapter, back-office]` Added ability to enable game only for selected wallets/operators/brands
- `[adapter, back-office, rgs, connector, shared]` Playtech integration
- `[back-office]` Made import buttons visible only if permisssion is granted
- `[adapter]` Moved IP white-listing under wallet adapter level
- `[connector, rgs]` Exposed player's `jurisdiction` in authentication
- `[back-office]` Increased limit of displayed transactions under Round page
- `[shared, rgs]` Fix remote files checksum calculation and switch to SHA1 checksum algorithms
- `[rgs]` Critical Files verification API adjustments
- `[adapter]` Added support for legacy game names in SoftSwiss

## 09.10.2023

```
"adapter" = "v2.0.0"
"promo" = "v1.3.2"
"demo-casino" = "v1.2.2"
"back-office" = "v2.0.0"
"rgs" = "v2.0.0"
"rng" = "v1.1.2"
"connector" = "v1.4.1"
```

```
"shared" = "v1.6.5"
"gdk" = "v1.3.2"
```

- `[gdk]` Added ability to dynamically define params in the simulator
- `[adapter]` iSoftBet integration fixes
- `[adapter]` Fixed `country` in a Game Win report
- `[promo]` Fixed Prize Drop UI issues in Connector
- `[promo]` Added Prize Drop translations to Connector
- `[promo, back-office]` Added ability to filter Campaigns on json fields
- `[adapter, rgs, back-office]` Fixed listing available wallets/rgs's in select fields
- `[adapter]` Removed legacy Demo Adapter
- `[rgs, back-office, services]` Implement critical files monitoring
- `[adapter]` SoftSwiss - moved player creation to authentication
- `[adapter]` iSoftBet - added `get_critical_files` method
- `[connector]` Fixed georgian translations
- `[promo]` Fix bug with creating campaign with limited permissions
- `[adapter, back-office]` Introduced session management and wallet `end` method
- `[adapter, rgs, back-office]` Introduced game management and removed `gameEnabled` setting
- `[connector]` add Session header display for Italian market regulation
- `[adapter, back-office]` ability to mark test Players
- `[adapter]` Moved wallet retires to the adapter code level
- `[rgs, back-office]` Add RTP Monitoring feature

## 05.09.2023

```
"adapter" = "v1.3.3"
"promo" = "v1.2.8"
"demo-casino" = "v1.1.10"
"back-office" = "v1.3.1"
"rgs" = "v1.3.0"
"rng" = "v1.0.22"
"connector" = "v1.3.5"
```

```
"shared" = "v1.5.20"
"gdk" = "v1.2.7"
```

- `[rgs]` Added `finishing` state to DB index
- `[connector, rgs]` Added unlimited game history
- `[adapter, infra]` Changed FIAT currencies feed from `floatrates` to `currencylayer`
- `[rgs, back-office]` Ability to change currency symbol
- `[adapter, back-office]` Added `country` to a Game Win report
- `[adapter]` Added information about password reset expiry time
- `[adapter]` Throwing explicit exception when player currency changes
- `[adapter, rgs, connector]` iSoftBet integration
- `[adapter]` Added more currencies in OpenBox integration
- `[adapter, rgs]` Moved cancel trigger completly to `rgs`
- `[adapter]` Disabled auto finish mechanism by default to rely on `rgs` trigger only
- `[promo, connector]` Implement Prize Drop campaign
- `[adapter]` Added new test to Integration Verifier for cancelling transactions that never reached the wallet
- `[rgs, adapter, connector]` Added balance to Game History
- `[rgs, back-office]` Introduced `autoCompleteExpiryTime`
- `[rgs]` Repeating unpaid wins during authentication
- `[rgs]` Introduced `unpaid` and remove `settled` state
- `[gdk]` fixed error with undefined RNG

## 31.07.2023

```
"adapter" = "v1.2.47"
"promo" = "v1.1.15"
"demo-casino" = "v1.1.10"
"back-office" = "v1.2.15"
"rgs" = "v1.2.24"
"rng" = "v1.0.22"
"connector" = "v1.2.24"
```

```
"shared" = "v1.5.16"
"gdk" = "v1.2.6"
```

- `[connector]` Added a custom loss limit message
- `[rgs, adapter, shared, promo, back-office]` Ability to sort by json type
- `[back-office, promo]` Added more details to a Campaigns section
- `[back-office]` Replays start after clicking button
- `[connector]` Added a custom error message for rejected transactions
- `[shared]` Fixed `correlationId` and `sessionId`
- `[adapter]` Add SoftSwiss wallet tests
- `[rgs]` Changed `availableBets` setting structure to enable bets on different actions
- `[adapter]` Make SoftSwiss wallet recognize `casino_id` as brand and have operator hardcoded to "softswiss"
- `[rgs, back-office]` Removed `AUTO_COMPLETE_HOURS` in favour of `autoCompleteHours` setting
- `[back-office]` Fixed scroll on campaign json popup
- `[rgs, connector]` Fixed rounding of free bets total win
- `[adapter]` Fixed missing currency notification if the `flatrates` feed is not available
- `[adapter]` Changed order of wallet verifier tests
- `[adapter, back-office]` Added optional `comment` to Accounts
- `[back-office]` Fixed UTC conversion for time filters
- `[infra, shared]` Tweaked graceful termination
- `[rgs, adapter, back-office]` Improved handling `started` transactions and rounds
- `[back-office]` Disabled autoscaling for `back-office`
- `[rgs, infra, adapter, back-office]` Switched to manual management for fixed currency rates
- `[connector]` Added custom error message for network error
- `[back-office]` Added filters to campaign fields in the Game Win report
- `[adapter, back-office, rgs, shared]` Ability to import Settings, Fixed Currency Rates and Accounts
- `[infra, adapter]` Added `DEFAULT_RGS` to adapter
- `[rng, shared, adapter]` Added email alerting about RNG failure
- `[adapter]` Removed `hrk` currency (discontinued Croatian kuna)
- `[shared]` Added request params to http logs
- `[adapter]` Implement OpenBox wallet adapter
- `[rng]` Invoking RNG verification every 10 minutes

## 22.06.2023

```
"adapter" = "v1.2.20"
"promo" = "v1.1.7"
"demo-casino" = "v1.1.2"
"back-office" = "v1.2.9"
"rgs" = "v1.2.9"
"rng" = "v1.0.12"
"connector" = "v1.2.20"
```

```
"shared" = "v1.4.6"
"gdk" = "v1.2.1"
```

- `[adapter]` changed currency `trn` to `trx`
- `[adapter]` removed `useGameToken` and made it a default behaviour
- `[adapter]` SoftSwiss changed launch a URL key to be based on `nativeId`
- `[promo]` require specifying at least one `playerId` or `nativeId` in `freeBets` campaigns
- `[connector]` Various fixes in free bets UI
- `[connector]` added `popupOpened` and `popupClosed` callbacks
- `[back-office]` fixed doubled filter values
- `[connector]` added version and licence text to exported file
- `[back-office]` improved auto complete selects highlight
- `[shared]` encrypting JWT payload
- `[infra]` increased timeout of a healthcheck to 10s
- `[all]` linter fixes and code reformatting
- `[rgs, back-office]` added `currencies` as `Settings` filter
- `[rgs]` Ability to set custom bets via `availableBets` setting
- `[connector]` significantly reduced docker size
- `[shared]` reduced log level of internal requests to `http`
- `[shared]` appending response body and rawBody to incoming api calls
- `[adapter]` implement response bodies logging for wallet incoming calls
- `[infra]` exposed `cluster-machine-type`, `cluster-max-nodes` and `cluster-max-nodes` terraform variables
- `[promo]` removed logging promo queries
- `[rgs]` fixed autocomplete problem with overriding data
- `[all]` updated Node.js version on dockers to node:20-slim

## 02.06.2023

```
"adapter" = "v1.2.14"
"promo" = "v1.1.2"
"demo-casino" = "v1.1.1"
"back-office" = "v1.2.2"
"rgs" = "v1.2.4"
"rng" = "v1.0.11"
"connector" = "v1.2.5"
```

```
"shared" = "v1.3.2"
"gdk" = "v1.2.0"
```

- `[rgs, adapter, promo]` removed most queries from audit logs (#24)
- `[infra]` removed secret config from games services (#22)
- `[adapter]` added `WALLET_INTEGRATION_PROCESS` and `GAME_INTEGRATION_PROCESS` documentations (#21)
- `[rgs]` added documentation (#21)
- `[adapter]` added setting `finishedAt` and `cancelledAt` during auto close (#27)
- `[connector]` free bets UI (#29)
- `[adapter, rgs, back-office]` Added currency autocomplete select field
- `[promo]` Fixed bet validation in free bets
- `[connector]` Fixed popups being visible in replay mode
- `[adapter]` Fixed passing `provider` in SoftSwiss integration
- `[all services]` change APP_MODE to IS_PRODUCTION flag (#28)
- `[rgs]` Fixed handling rounds in `finishing` state in auto complete
- `[connector]` Added new languages and language mappings
- `[adapter]` Improved error logging in Wallet Verifier and Game Verifier
- `[shared, back-office, rgs, adapter]` Improved filtering in Settings and Accounts
- `[adapter]` Fixed Wallet Verifier with `useGameToken` enabled wallets
- `[adapter]` Added `provider` to `PlayerGameToken` (for large databases please create
  index `adapter_player_game_token_playerId_provider_game` concurrently)
- `[adapter][infra]` renamed `ALERT_MAIL` to `SUPPORT_EMAIL`
- `[adapter][infra]` removed removing from bucket before redeploying connector (overwriting previous)

## 23.05.2023

```
"adapter" = "v1.1.2"
"promo" = "v1.1.0"
"demo-casino" = "v1.1.0"
"back-office" = "v1.2.0"
"rgs" = "v1.2.0"
"rng" = "v1.0.10"
"connector" = "v1.1.0"
```

```
"shared" = "v1.0.1"
"gdk" = "v1.1.0"
```

- `[rgs]` removed `gdk` dependency from `rgs`
- `[rng]` loosened `rng` verification criteria for Chi Squared tests
- `[infra]` add docker registry login in `connector.js` provisioning
- `[adapter]` Added new currencies
- `[adapter]` Added email notification about missing currencies
- `[adapter]` Fallback in case of missing currency exchange rate
- `[back-office, rgs, adapter]` Added an autocomplete suggestion to most of the select fields
- `[back-office, adapter]` fixed audit logs for `changePassword` and improved logging of multiple actions in a single
  request
- `[infra]` removed cron tasks and ingress paths when a module is not available
- `[infra]` upgraded from `kubernetes_cron_job` to `kubernetes_cron_job_v1` as it was deprecated (remove cron jobs
  manually before `terraform apply`)
- `[demo-casino]` ability to cheat player's jurisdiction
- `[connector]` added game history button and open, continue callbacks to reality check (
  use `connector.initRealityCheck` to explicitly initialise reality check)
- `[adapter]` Improved error handling and added types in SoftSwiss wallet
- `[promo]` fixed currency conversion for non-existing player bets
- `[infra, shared]` enabled CORS, added cors-origin variable to terraform schemas
- `[rgs, gdk, back-office]` improvements around currency precision handling
- `[infra]` Ability to pass custom evn variables in `main.tf`

## 18.04.2023

- `[rgs, adapter, infra]` increased timeout of cron calls
- `[connector]` fixed "skip" button when `next` is an empty array
- `[backoffice]` fixed clear button on complex filters in DataTable
- `[connector]` game history back button positioning
- `[rgs, promo, adapter]` changed `json` to `jsonb` in `rgs_wager`, `promo_campaign_response` and `adapter_monitoring`
  for better performance
- `[rgs]` removed unnecessary database indexes
- `[infra]` separated `rgs-name` from `name` in Terraform variables

## 22.03.2023

- `[infra, rgs]` Added possibility to configure auto complete delay
- `[promo]` improved performance of fetching player campaigns
- `[adapter]` improved real time suspicious patterns monitoring
- `[adapter]` added `roundId` to `/cancel` call in Standard Wallet Adapter
- `[connector]` added close handler in Game History UI
- `[infra]` increased max database connections
- `[adapter, back-office]` ability to enable/disable wallet
- `[adapter]` added `rejected` status for transactions not passing validation
- `[rgs, shared] `Added `maxAge` to CORS improving performance of requests

## 23.02.2023

- `[promo]` fixed campaign permission verification
- `[rng, infra]` RNG standalone service
- `[rng]` RNG CLI tool
- `[back-office]` fixed issue with sorting after using `DATE` filter in `DataTable`
- `[rgs, back-office]` Added Automated Game Verification Tool
- `[adapter]` Support for dynamic wallet endpoint URL (mainly for Soft2Bet)
- `[infra]` refactored Kubernetes terraform file (In case of Terraform errors, remove conflicting Kubernetes workload
  and retry)
- `[infra]` Removed hardcoded version prefix (`v`) in `[app.tf](http://app.tf)` and moved it to `main.tf` so it becomes
  optional
- `[shared, connector, adapter]` Improved `x-correlation-id` workflow and added `x-session-id`
- `[gdk, rng]` Moved RNG algorithms from GDK to RNG module
- `[rng]` Added RNG monitoring (chi-square test)

## 20.01.2023

- `[infra]` added support for GKE Autopilot and Spot instances
- `[infra]` added configurable Kubernetes namespace
- `[infra, rgs, gdk]` Support for multiple games services
- `[adapter, back-office]` Ability to send multiple password reminders and renamed `remindPassword` to `resetPassword`
- `[adapter]` improved mail title and footer
- `[adapter, back-office]` Add `provider` to Integration Verifier
- `[all]` Added `rgs` to separate from `provider`
- `[back-office]` fixed handling `DATE` and `TIME` in `DataTable`
- `[adapter, rgs, back-office]` Wallet and RGS IP white-listing of incoming calls
- `[back-office]` improved JSON editing
- `[infra]` Extracted `coin-api-key` as variable
- `[connector]` Added `params` to `play` method

## 06.12.2022

- `[adapter]` Passing `player` instance to wallet adapters to avoid doubled db queries (please verify compatibility with
  your custom integrations!)
- `[rgs, adapter]` Ability to overwrite provider for multi-provider RGS strategy
- `[adapter, back-office]` Added logout as GraphQL mutation and login/logout to Audit Log
- `[adapter, back-office]` Integration Verifier to create two sessions to test tokens between games
- `[adapter]` Fixed handling aggregation for cancelled transactions when cancel occurred after the transaction was
  aggregated as finished
- `[adapter, back-office]` Added logging IP and white-listing status in Audit Log
- `[rgs, adapter, back-office]` Added logging player IP for transactions
- `[rgs]` Cached game bets to reduce the number of internal requests
- `[all]` Promo module - final version
- `[adapter]` added brand (same as operator) for SoftSwiss integration to avoid confusion

## 15.11.2022

- `[adapter]` Future Anthem integration
- `[adapter]` Ability to overwrite `game` param with fixed value in Standard wallet
- `[adapter, back-office]` Storing transaction fail reason
- `[back-office]` Redirect to previous url after log in
- `[back-office]` Saving data table state in the URL
- `[back-office]` Disabling buttons during data loading
- `[adapter]` Optimised transaction insert query
- `[infra]` Added dynamic compression for CDN
- `[infra]` Upgraded terraform providers to the latest versions (please run `terraform init -upgrade`)
- `[all]` Updated npm dependencies

## 18.10.2022

- `[adapter]` Optimised reporting queries (and some others too) with indexes
- `[adapter]` Added new currencies
- `[adapter]` Real time transaction verification and alerting
- `[rgs, back-office]` Added an available bets checker
- `[rgs, adapter, back-office]` Added `winRatio` of a base bet

## **20.09.2022**

- `[promo, adapter]` Promo tools (phase 2)
- `[promo, back-office]` Leaderboard promo tool
- `[promo, back-office]` Free bets promo tool
- `[adapter]` Fixed bug in verifier that it did not work for existing users
- `[adapter]` Added `game` param to verifier
- `[adapter]` Fixed permission check in deleting accounts
- `[adapter]` Added `game` and `provider` to balance wallet calls
- `[adapter]` Removed `cancelOnFail` flag to have always same transaction flow
- `[adapter]` White-listing IPs for an account to avoid session expiry
- `[rgs, back-office]` Setting checker
- `[adapter]` Validating supported currencies during authentication
- `[adapter]` Option to use token per game in Standard Wallet
- `[infra]` Restricted territories IP and API blocks

## 10.08.2022

- `[adapter]` SoftSwiss integration
- `[all]` Update of node packages especially update of TypeORM
- `[rgs]` Removed transaction in favour of database unique indexes
- `[all]` Lots of optimisations

## 07.07.2022

- `[adapter]` Added audit logs
- `[adapter]` Fixed GraphQL stitching permission bug (directives were not passed via introspection)
- `[demo-casino]` Fixed demo-casino clear
- `[adapter]` Renamed `promotionId` and `promotionType` to `campaignId` and `campaignType`

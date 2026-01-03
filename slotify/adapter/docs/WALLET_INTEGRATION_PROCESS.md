# Wallet Integration Process

_Provider_ - owner of the RGS i.e. game studio

_Operator_ - casino operator or reseller to other casinos

## Standard Integration (Operator integrates to Provider)

In 95% of cases, reseller/operator integrates to provider. The Provider needs to have a direct contract with Operator or Reseller.

### Staging integration

1. Provider sends to operator tech documentation (`WALLET_INTEGRATION.pdf`) for the review

2. Operator needs to create an endpoint and share its URL

3. Provider configures new wallet in the Back Office (Wallets→Add)
    1. ID is the unique name of the integration i.e. `my-wallet`
    2. Adapter is always `standard` if operator integrates to provider
    3. Config contains of url provided in step 2 and randomly generated secret key (for staging env, it can be something easy to read like `secret-my-wallet`

        ```json
        {
        	"url": "https://exmaple.com",
        	"secretKey": "some-secret-key",
        }
        ```

4. Optionally, we can create Back Office Account for Operator(Accounts→Add)
    1. email of the person working on the integration or generic email of support or integration team
    2. Permissions typically include: `verifier`, `transactions`, `players`, `gameWin`
    3. Wallets should contain wallet id created in step 3 (i.e. `my-wallet`)
    4. After an account is created email will be sent with instructions to log in

5. Provider sends to operator wallet id, secret key and IP of the environment (`terraform output outbound-ip`)  - white-listing by Operator is optional

6. Operator starts a wallet integration process. Use Wallet Verifier tool in the Back Office to test the integration (If the account in point 4 was created Operator can use it themselves).
   <br/>_For the operators already integrated to the platform such as Solid, Hub88, AzureTech and others they just configure another endpoint. Development work should not be required._

7. Once Operator confirms finishing the integration, Provider should also launch Wallet Verifier to confirm (operator needs to provide two session keys for the same player)

8. The only manual element to be tested is autocomplete. Leave the round open for 24 hours and see if the round is finished correctly after that

9. Ask operator for preferred configuration (min bet, max bet, max bonus bet, max exposure, default bet, math variants) and apply it per wallet, operator or brand

10. Launch a few games and run smoke tests (a few winning and loosing spins)

### Going live on production

1. Operator needs to create a production endpoint and share its URL

2. Provider configures new wallet in the Back Office (Wallets→Add) with the same wallet id and adapter as on staging, but different url and secretKey

3. Provider sends to operator production secretKey (very confidential) and IP of production env for white-listing (white-listing by Operator is optional)

4. Copy settings form staging

5. Launch a few games and run smoke tests (a few winning and loosing spins)

## Custom Integration (Provider integrates to Operator)

Provider integrating Operator’s API is quite rare but happens. It requires custom code implementation.

### Staging integration

1. Operator sends to Provider tech documentation for the review

2. Provider configures new wallet in the Back Office (Wallets→Add)
    1. ID is the unique name of the integration i.e. `my-wallet`
    2. Adapter is the name of custom integration. Usually it will be the same as wallet id (because it’s custom for the wallet)
    3. Config contains any value that is useful for the implementation

3. Provider send to operator IP of the environment (`terraform output outbound-ip`)  - white-listing by Operator is optional

4. Provider starts wallet integration process.
   <br/> This step requires custom code development unless it is one of the custom integrations we support. Currently supported custom integrations are: SoftSwiss.**

5. Ask operator for preferred configuration (min bet, max bet, max bonus bet, max exposure, default bet, math variants) and apply it per wallet, operator or brand

6. Launch a few games and run smoke tests (a few winning and loosing spins)

### Going live on production

1. The Provider configures new wallet in the Back Office (Wallets→Add) with the same wallet id and adapter as on staging. Some id or secret key should probably change compared to staging

2. Thg provider sends IP of production env for white-listing (white-listing by Operator is optional)

3. Copy settings form staging

4. Launch a few games and run smoke tests (a few winning and loosing spins)
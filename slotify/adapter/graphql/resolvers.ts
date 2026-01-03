import GraphQLJSON, {GraphQLJSONObject} from "graphql-type-json";
import {Account} from "../db/model/Account";
import {accounts, auditLogs, currencyAliases, currencyExchange, currencyFeeds, DGE_gameSummary, games, gameWin, players, reportReceivers, reportExclusion, rgss, sessions, transactions, wallets} from "../route/report";
import walletVerifier from "../walletAdapterVerifier/walletVerifier";
import {CurrencyAlias} from "../db/model/CurrencyAlias";
import {Rgs} from "../db/model/Rgs";
import {Wallet} from "../db/model/Wallet";
import Exception from "@slotify/shared/lib/Exception";
import {PasswordReset} from "../db/model/PasswordReset";
import {v4} from "uuid";
import {newAccountText, newAccountTitle, resetPasswordText, resetPasswordTitle} from "../mail/texts";
import {IAccount, IOptions} from "@slotify/shared/lib/graphQLApi";
import {Transaction} from "../db/model/Transaction";
import {jwtSign} from "../middleware/jwtAuth";
import {TransactionCube} from "../db/model/TransactionCube";
import {In} from "typeorm";
import {Player} from "../db/model/Player";
import {invalidate} from "@slotify/shared/lib/cache";
import {isDevMode} from "@slotify/shared/lib/isDevMode";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {clearEmpty} from "@slotify/shared/lib/clearEmpty";
import {CurrencyExchange} from "../db/model/CurrencyExchange";
import {importCsv} from "@slotify/shared/lib/importCSV";
import {sendMail} from "@slotify/shared/lib/mail";
import {Game} from "../db/model/Game";
import {Session} from "../db/model/Session";
import {CurrencyFeed} from "../db/model/CurrencyFeed";
import cube from "../route/cube";
import {getServices, getSettings} from "../util/external";
import {sendAlert} from "@slotify/shared/lib/sendAlert";
import {DateTime} from "../util/luxon";
import {fetchCurrencies, updateLastCurrencyExchangeOfAlias} from "../currencyFeed/currencyFeed";
import {ReportReceiver} from "../db/model/ReportReceiver";
import {sendReport} from "../route/sendReports";
import {ReportExclusion} from "../db/model/ReportExclusion";
import {scheduleReport, unscheduleReport} from "../util/scheduledTasks";
import {validateCron} from "@slotify/shared/lib/scheduler";
import logger from "@slotify/shared/lib/logger";
import {resetWalletCache} from "../inspection/verification";
import {getIp} from "@slotify/shared/lib/ip";
import {Request} from "express";

interface IContext {
    account: IAccount;
}

function validateSubList(list: Set<string>, subList: string[] | undefined, fieldName: string) {
    if (list.size !== 0 && subList && (subList.length === 0 || subList.some(value => !list.has(value)))) {
        throw new Exception(`${fieldName} needs to be specified and each of them needs to be from: ${[...list].join(",")}`);
    }
}

function validateSubAccount(subAccount: Account, account: IAccount) {
    if (subAccount.permissions?.find(permission => !account.permissions?.includes(permission))) throw new Exception("Sub-account can only have permissions which main account contains");

    validateSubList(new Set(account.rgss), subAccount.rgss, "RGS");
    validateSubList(new Set(account.providers), subAccount.providers, "Provider");
    validateSubList(new Set(account.wallets), subAccount.wallets, "Wallet");
    validateSubList(new Set(account.operators), subAccount.operators, "Operator");
    validateSubList(new Set(account.brands), subAccount.brands, "Brand");
}

function validateGame(game: Game, account: IAccount) {
    validateSubList(new Set(account.rgss), [game.rgs], "RGS");
    validateSubList(new Set(account.providers), [game.provider], "Provider");
    validateSubList(new Set(account.wallets), game.wallets, "Wallet");
    validateSubList(new Set(account.operators), game.operators, "Operator");
    validateSubList(new Set(account.brands), game.brands, "Brand");
}

function validateRgs(rgs: Rgs, account: IAccount) {
    validateSubList(new Set(account.rgss), [rgs.id], "RGS");
}

function validateWallet(wallet: Wallet, account: IAccount) {
    validateSubList(new Set(account.rgss), [wallet.id], "Wallet");
}

async function getDistinctCubeFields(field: keyof TransactionCube, account: IAccount) {
    return (
        await getConnection("replica")
            .createQueryBuilder(TransactionCube, "cube")
            .select(field)
            .distinct(true)
            .where(
                clearEmpty({
                    "rgs": account.rgss ? In(account.rgss) : undefined,
                    "provider": account.providers ? In(account.providers) : undefined,
                    "wallet": account.wallets ? In(account.wallets) : undefined,
                    "operator": account.operators ? In(account.operators) : undefined,
                    "brand": account.brands ? In(account.brands) : undefined,
                }),
            )
            .getRawMany()
    )
        .map(item => item[field])
        .filter(item => !!item)
        .sort();
}

async function getDistinctPlayerFields(field: keyof Player, account: IAccount) {
    return (
        await getConnection("replica")
            .createQueryBuilder(Player, "player")
            .select(field)
            .distinct(true)
            .where(
                clearEmpty({
                    "wallet": account.wallets ? In(account.wallets) : undefined,
                    "operator": account.operators ? In(account.operators) : undefined,
                    "brand": account.brands ? In(account.brands) : undefined,
                }),
            )
            .getRawMany()
    )
        .map(item => item[field])
        .filter(item => !!item)
        .sort();
}

export default {
    JSON: GraphQLJSON,
    JSONObject: GraphQLJSONObject,
    Query: {
        ping() {
            return true;
        },
        async auditLogs(_: any, {sort, filter, limit, offset}: IOptions) {
            return auditLogs(sort, filter, limit, offset);
        },
        async accounts(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return accounts(sort, filter, limit, offset, account);
        },
        async players(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return players(sort, filter, limit, offset, account);
        },
        async sessions(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return sessions(sort, filter, limit, offset, account);
        },
        async transactions(_: any, {sort, filter, limit, offset, options}: IOptions, {account}: IContext) {
            return transactions(sort, filter, limit, offset, account, options);
        },
        async gameWin(_: any, {sort, filter, limit, offset, options}: IOptions, {account}: IContext) {
            return gameWin(sort, filter, limit, offset, account, options);
        },
        async currencyExchange(_: any, {sort, filter, limit, offset}: IOptions) {
            return currencyExchange(sort, filter, limit, offset);
        },
        async currencyAliases(_: any, {sort, filter, limit, offset}: IOptions) {
            return currencyAliases(sort, filter, limit, offset);
        },
        async currencyFeeds(_: any, {sort, filter, limit, offset}: IOptions) {
            return currencyFeeds(sort, filter, limit, offset);
        },
        async rgss(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return rgss(sort, filter, limit, offset, account);
        },
        async wallets(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return wallets(sort, filter, limit, offset, account);
        },
        async games(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return games(sort, filter, limit, offset, account);
        },
        async walletList(_: any, {}: any, {account}: IContext) {
            return await getDistinctCubeFields("wallet", account);
        },
        async rgsList(_: any, {}: any, {account}: IContext) {
            return await getDistinctCubeFields("rgs", account);
        },
        async gameList(_: any, {}: any, {account}: IContext) {
            return await getDistinctCubeFields("game", account);
        },
        async providerList(_: any, {}: any, {account}: IContext) {
            return await getDistinctCubeFields("provider", account);
        },
        async operatorList(_: any, {}: any, {account}: IContext) {
            return await getDistinctPlayerFields("operator", account);
        },
        async brandList(_: any, {}: any, {account}: IContext) {
            return await getDistinctPlayerFields("brand", account);
        },
        async jurisdictionList(_: any, {}: any, {account}: IContext) {
            return await getDistinctPlayerFields("jurisdiction", account);
        },
        async currencyList() {
            return (await getConnection("replica").createQueryBuilder(CurrencyExchange, "currency").select().distinctOn(["currency.currency"]).getMany()).map(item => item.currency).sort();
        },
        async reportReceivers(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return reportReceivers(sort, filter, limit, offset, account);
        },
        async reportExclusion(_: any, {sort, filter, limit, offset}: IOptions, {account}: IContext) {
            return reportExclusion(sort, filter, limit, offset, account);
        },
        async availableGames(_: any, {wallet, operator, brand}: any, {account}: IContext) {
            if (account.wallets && !account.wallets.includes(wallet)) throw new Exception("Incorrect wallet specified");
            if (account.operators && !account.operators.includes(operator)) throw new Exception("Incorrect operator specified");
            if (brand && account.brands && !account.brands.includes(brand)) throw new Exception("Incorrect brand specified");

            const games = [];
            for (const {game, title, provider, type, rgs} of await Game.allGames()) {
                if (await Game.verify(game, wallet, operator, brand)) {
                    if (rgs !== process.env.DEFAULT_RGS || (await getSettings(clearEmpty({wallet, operator, brand, provider, game}))).gameEnabled === "true") {
                        games.push({provider, game, title, type});
                    }
                }
            }
            return games;
        },
        async DGE_gameSummary(_: any, {sort, filter = [], options, limit, offset}: IOptions, account: IAccount) {
            return DGE_gameSummary(sort, filter, limit, offset, account, options);
        },
    },
    Mutation: {
        async login(_: any, {email, password}: {email: string; password: string}, {req}: {req: Request}) {
            const account = await Account.validate(email, password);
            if (account.ips && !account.isWhitelisted(getIp(req))) {
                throw new Exception("Access denied", {code: "ACCESS_DENIED"});
            }

            await Account.update({email}, {lastActivity: new Date(), activeSession: true});

            const token = jwtSign(email);
            return {account: account.toData(), services: getServices(), token};
        },
        async logout(_: any, params: any, {account}: IContext) {
            await Account.update({email: account.email}, {activeSession: false});
            return true;
        },
        async addAccount(_: any, {data}: {data: Account}, {account}: IContext) {
            validateSubAccount(data, account);
            const email: string = data.email;
            if (await Account.findOneBy({email})) {
                throw new Exception("Item already exists");
            }
            const key = v4();
            await sendMail(email, newAccountTitle, newAccountText(key));

            await PasswordReset.create({key, email}).save();
            const {id} = await Account.create({...data, password: "", lastActivity: null}).save();

            sendAlert(
                "New account created",
                `
            Account: ${data.email}<br/>
            Created by: ${account.email}<br/>
            Permissions: ${(data.permissions || []).join(", ")}<br/>
            Wallets: ${(data.wallets || []).join(", ")}<br/>
            Operators: ${(data.operators || []).join(", ")}<br/>
            Brands: ${(data.brands || []).join(", ")}<br/>
            Providers: ${(data.providers || []).join(", ")}<br/>
            RGSs: ${(data.rgss || []).join(", ")}<br/>
            `,
            );

            return id;
        },
        async deleteAccount(_: any, {id}: {id: string}, {account}: IContext) {
            const data = await Account.findOneBy({email: id});
            if (!data) throw new Exception("Account doesn't exist");
            validateSubAccount(data, account);
            if (account.email === id) throw new Exception("You cannot delete your account");
            await Account.delete({email: id});
            return true;
        },
        async editAccount(_: any, {id, data}: {id: string; data: Account}, {account}: IContext) {
            validateSubAccount(data, account);
            if (account.email === data.email) throw new Exception("You cannot edit your account");
            if (id !== data.email && (await Account.findOneBy({email: data.email}))) {
                throw new Exception("Item already exists");
            }
            await Account.update({email: id}, {wallets: undefined, operators: undefined, brands: undefined, providers: undefined, ...data});
            return true;
        },
        async changePassword(_: any, {password, key}: {password: string; key: string}) {
            if (!(await PasswordReset.isKeyActive(key))) throw new Exception("Password reset key incorrect or expired");
            if (password.length < 6) throw new Exception("Password must have at least 6 characters");
            const {email} = (await PasswordReset.findOneBy({key}))!;
            if (email.toLowerCase() === password.toLowerCase()) throw new Exception("Password and email cannot be the same");
            await Account.update({email}, {password: Account.hashPassword(password)});
            await PasswordReset.delete({key});
            return {email};
        },
        async resetPassword(_: any, {email}: {email: string}) {
            if (!(await Account.findOneBy({email}))) throw new Exception("Email doesn't exist");
            if (await PasswordReset.hasActiveKey(email)) throw new Exception("Password reset request already sent");

            const key = v4();
            await sendMail(email, resetPasswordTitle, resetPasswordText(key));
            await PasswordReset.create({key, email}).save();

            return true;
        },
        async editCurrencyFeed(_: any, {feed, data}: {feed: string; data: Partial<CurrencyFeed>}) {
            await CurrencyFeed.update({feed}, data);
            invalidate("currencyFeeds");
            return true;
        },
        async addCurrencyAlias(_: any, {data}: {data: CurrencyAlias}) {
            if (await CurrencyAlias.findOneBy({alias: data.alias})) {
                throw new Exception("Item already exists");
            }
            const {alias} = await CurrencyAlias.save(CurrencyAlias.create(data));
            await updateLastCurrencyExchangeOfAlias(data.alias, data.currency, data.multiplier);
            invalidate("currencyAliases");
            return alias;
        },
        async editCurrencyAlias(_: any, {alias, data}: {alias: string; data: CurrencyAlias}) {
            if (alias !== data.alias && (await CurrencyAlias.findOneBy({alias: data.alias}))) {
                throw new Exception("Item already exists");
            }
            await CurrencyAlias.update({alias}, data);
            await updateLastCurrencyExchangeOfAlias(data.alias, data.currency, data.multiplier);
            invalidate("currencyAliases");
            return true;
        },
        async deleteCurrencyAlias(_: any, {alias}: {alias: string}) {
            await CurrencyAlias.delete({alias});
            invalidate("currencyAliases");
            return true;
        },

        async addCurrencyExchange(_: any, {data}: {data: CurrencyAlias}) {
            const {id} = await CurrencyExchange.save(CurrencyExchange.create(data));
            return id;
        },
        async editCurrencyExchange(_: any, {id, data}: {id: number; data: CurrencyExchange}) {
            await CurrencyExchange.update({id}, data);
            return true;
        },
        async deleteCurrencyExchange(_: any, {id}: {id: number}) {
            await CurrencyExchange.delete({id});
            return true;
        },

        async addRgs(_: any, {data}: {data: Rgs}, {account}: IContext) {
            validateRgs(data, account);
            if (await Rgs.findOneBy({id: data.id})) {
                throw new Exception("Item already exists");
            }
            const {id} = await Rgs.save(Rgs.create(data));
            invalidate("rgss");
            return id;
        },
        async editRgs(_: any, {id, data}: {id: string; data: Rgs}, {account}: IContext) {
            if (id !== data.id && (await Rgs.findOneBy({id: data.id}))) {
                throw new Exception("Item already exists");
            }
            validateRgs(data, account);
            await Rgs.update({id}, data);
            invalidate("rgss");
            return true;
        },
        async deleteRgs(_: any, {id}: {id: string}, {account}: IContext) {
            const data = await Rgs.findOneBy({id});
            if (!data) {
                throw new Exception("Item does not exist");
            }
            validateRgs(data, account);
            await Rgs.delete({id});
            invalidate("rgss");
            return true;
        },
        async addWallet(_: any, {data}: {data: Wallet}, {account}: IContext) {
            validateWallet(data, account);
            if (await Wallet.findOneBy({id: data.id})) {
                throw new Exception("Item already exists");
            }
            const {id} = await Wallet.save(Wallet.create(data));
            invalidate("wallets");
            return id;
        },
        async editWallet(_: any, {id, data}: {id: string; data: Wallet}, {account}: IContext) {
            if (id !== data.id && (await Wallet.findOneBy({id: data.id}))) {
                throw new Exception("Item already exists");
            }
            validateWallet(data, account);
            await Wallet.update({id}, data);
            invalidate("wallets");
            return true;
        },
        async deleteWallet(_: any, {id}: {id: string}, {account}: IContext) {
            const data = await Wallet.findOneBy({id});
            if (!data) {
                throw new Exception("Item does not exist");
            }
            validateWallet(data, account);
            await Wallet.delete({id});
            invalidate("wallets");
            return true;
        },
        async resetWalletInspection(_: any, {id}: {id: string}, {account}: IContext) {
            const data = await Wallet.findOneBy({id});
            if (!data) {
                throw new Exception("Item does not exist");
            }
            validateWallet(data, account);
            await resetWalletCache(id);
            return true;
        },
        async addGame(_: any, {data}: {data: Game}, {account}: IContext) {
            validateGame(data, account);
            if (await Game.findOneBy({game: data.game})) {
                throw new Exception("Item already exists");
            }

            const {game} = await Game.save(Game.create(data));
            invalidate("games");
            return game;
        },
        async editGame(_: any, {game, data}: {game: string; data: Game}, {account}: IContext) {
            if (game !== data.game && (await Game.findOneBy({game: data.game}))) {
                throw new Exception("Item already exists");
            }
            validateGame(data, account);

            await Game.update({game}, data);
            invalidate("games");
            return true;
        },
        async deleteGame(_: any, {game}: {game: string}, {account}: IContext) {
            const data = await Game.findOneBy({game: game});
            if (!data) {
                throw new Exception("Item does not exist");
            }
            validateGame(data, account);
            await Game.delete({game});
            invalidate("games");
            return true;
        },
        async importGames(_: any, {data}: {data: string}, {account}: IContext) {
            return await importCsv(
                Game,
                "game",
                data,
                {
                    game: value => value,
                    provider: value => value,
                    rgs: value => value,
                    title: value => value,
                    rgsGame: value => value,
                    type: value => value as any,
                    rgsConfig: value => JSON.parse(value),
                    inspectionConfig: value => JSON.parse(value),
                    wallets: value => value.split(","),
                    operators: value => value.split(","),
                    brands: value => value.split(","),
                },
                data => this.addGame(null, {data}, {account}),
                data => this.editGame(null, {game: data.game, data}, {account}),
            );
        },
        async closeTransaction(_: any, {id}: {id: string}) {
            const transaction = await Transaction.findOneBy({id});
            if (!transaction) throw new Exception("Couldn't find transaction to force cancel", {data: {id}});
            if (transaction.type === "withdraw") {
                if (transaction.status == "cancel") {
                    transaction.status = "cancelled";
                    transaction.cancelledAt = new Date();
                } else if (transaction.status == "started") {
                    transaction.status = "cancel";
                } else {
                    throw new Exception("Withdraw transaction needs to be in cancel state", {data: {id}});
                }
            } else if (transaction.type === "deposit") {
                if (transaction.status === "failed") {
                    transaction.status = "finished";
                    transaction.finishedAt = new Date();
                } else if (transaction.status === "rejected") {
                    transaction.status = "failed";
                } else if (transaction.status === "started") {
                    transaction.status = "failed";
                } else {
                    throw new Exception("Deposit transaction needs to be in failed or rejected state", {data: {id}});
                }
            }
            await transaction.save();
            return true;
        },
        async regenerateGameWin(_: any, {date}: {date: string}) {
            const startTime = DateTime.local();
            await cube(new Date(date), 1000, () => {
                const duration = DateTime.local().diff(startTime).shiftToAll().rescale().toHuman({unitDisplay: "long"});
                const content = `Regeneration from ${new Date(date).toLocaleDateString()} finished. Calculation took ${duration}`;
                sendAlert("GW regeneration finished", content);
            });
            return true;
        },
        async fetchCurrencies(_: any, {date}: {date: string}) {
            const daysAgo = Math.floor(DateTime.local().diff(DateTime.fromISO(date), "days").as("days"));
            fetchCurrencies(daysAgo).catch(e => {
                logger.warn("Error fetching currencies", {error: e});
            });
            return true;
        },
        async editPlayer(_: any, {id, value}: {id: string; value: {blocked?: boolean; test?: boolean; group?: string}}) {
            await Player.update({id}, value);
            return true;
        },
        async endSession(_: any, {sessionId}: {sessionId: string}) {
            await Session.update({sessionId}, {active: false, endedAt: new Date()});
            return true;
        },
        async walletVerifier(_: any, {wallet, operator, provider, key, game, key2, game2}: any, {account}: IContext) {
            if (!isDevMode()) throw new Exception("Verifier is supposed to be used on on non-production environments");
            if ((await Wallet.findOneBy({id: wallet}))?.adapter !== "standard") throw new Exception("Verifier is supposed to work only with standard wallet adapters");
            if (account.wallets && !account.wallets.includes(wallet)) throw new Exception(`You don't have permission to wallet ${wallet}`);
            return await walletVerifier(wallet, operator, provider, key, game, key2, game2);
        },
        async importAccounts(_: any, {data}: {data: string}, {account}: IContext) {
            return await importCsv(
                Account,
                "email",
                data,
                {
                    email: value => value,
                    comment: value => value,
                    permissions: value => (value !== "" ? value.split(",") : undefined),
                    ips: value => (value !== "" ? value.split(",") : undefined),
                    rgss: value => (value !== "" ? value.split(",") : undefined),
                    providers: value => (value !== "" ? value.split(",") : undefined),
                    wallets: value => (value !== "" ? value.split(",") : undefined),
                    operators: value => (value !== "" ? value.split(",") : undefined),
                    brands: value => (value !== "" ? value.split(",") : undefined),
                },
                data => this.addAccount(null, {data}, {account}),
                data => this.editAccount(null, {id: data.email, data}, {account}),
            );
        },
        async addReportReceiver(_: any, {data}: {data: ReportReceiver}, {account}: IContext) {
            if (data.cron && !validateCron(data.cron)) throw new Exception("Invalid cron expression");

            const report = await ReportReceiver.save(ReportReceiver.create({...data, account: account.email}));
            await scheduleReport(report);
            return report.id;
        },
        async editReportReceiver(_: any, {id, data}: {id: number; data: Partial<ReportReceiver>}, {account}: IContext) {
            if (data.cron && !validateCron(data.cron)) throw new Exception("Invalid cron expression");

            const report = await ReportReceiver.findOneByOrFail({id});
            if (report.account !== account.email) throw new Exception("This report does not belong to your account");

            await ReportReceiver.update({id}, data);
            await scheduleReport(await ReportReceiver.findOneByOrFail({id}));
            return true;
        },
        async deleteReportReceiver(_: any, {id}: {id: number}, {account}: IContext) {
            const report = await ReportReceiver.findOneByOrFail({id});
            if (report.account !== account.email) throw new Exception("This report does not belong to your account");

            await ReportReceiver.delete({id});
            await unscheduleReport(id);
            return true;
        },
        async sendReport(_: any, {id}: {id: number}, {account}: IContext) {
            const report = await ReportReceiver.findOneByOrFail({id});
            if (report.account !== account.email) throw new Exception("This report does not belong to your account");

            await sendReport(report, Date.now());
            return true;
        },
        async addReportExclusion(_: any, {data}: {data: ReportExclusion}) {
            const {id} = await ReportExclusion.save(
                ReportExclusion.create({
                    ...data,
                    startsAt: data.startsAt ? new Date(data.startsAt) : null,
                    endsAt: data.endsAt ? new Date(data.endsAt) : null,
                }),
            );
            return id;
        },
        async editReportExclusion(_: any, {id, data}: {id: number; data: Partial<ReportExclusion>}, {account}: IContext) {
            const report = await ReportExclusion.findOneByOrFail({id});
            if (report.wallet && account.wallets?.includes(report.wallet)) throw new Exception("This report exclusion does not belong to your account");
            if (report.operator && account.operators?.includes(report.operator)) throw new Exception("Incorrect operator specified");
            if (report.brand && account.brands?.includes(report.brand)) throw new Exception("Incorrect brand specified");

            await ReportExclusion.update(
                {id},
                {
                    ...data,
                    startsAt: (data as any).startsAt ? new Date((data as any).startsAt) : null,
                    endsAt: (data as any).endsAt ? new Date((data as any).endsAt) : null,
                },
            );
            return true;
        },
        async deleteReportExclusion(_: any, {id}: {id: number}, {account}: IContext) {
            const report = await ReportExclusion.findOneByOrFail({id});
            if (report.wallet && account.wallets?.includes(report.wallet)) throw new Exception("This report exclusion does not belong to your account");
            if (report.operator && account.operators?.includes(report.operator)) throw new Exception("Incorrect operator specified");
            if (report.brand && account.brands?.includes(report.brand)) throw new Exception("Incorrect brand specified");

            await ReportExclusion.delete({id});
            return true;
        },
    },
};

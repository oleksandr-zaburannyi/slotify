import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";
import Exception from "@slotify/shared/lib/Exception";
import {ISession} from "../../walletAdapter/IWalletAdapter";
import {getConnection} from "@slotify/shared/lib/dbOptions";
import {anonymiseIp} from "../../util/ip";
import {scheduleTask} from "@slotify/shared/lib/scheduler";

export type ISessionData = {
    italy?: {
        sessionId: string;
        ticketid: string;
    };
    betConfig?: {
        minBet?: number;
        maxBet?: number;
        maxBonusBet?: number;
        maxExposure?: number;
        defaultBet?: number;
    };
    settings?: {
        gameVariant?: string;
        lobbyUrl?: string;
        historyUrl?: string;
        depositUrl?: string;
        [key: string]: any;
    };
    currencyRate?: number;
    [key: string]: any;
};

@Entity()
export class Session extends BaseEntity {
    @PrimaryGeneratedColumn() sessionId!: string;
    @CreateDateColumn({type: "timestamptz"}) createdAt!: Date;
    @Column({type: "timestamptz"}) lastActivity?: Date;
    @Column({type: "timestamptz"}) endedAt?: Date;
    @Column({type: "timestamptz"}) lastFail?: Date;
    @Column() playerId!: string;
    @Column() provider?: string;
    @Column() game?: string;
    @Column() key?: string;
    @Column() token!: string;
    @Column() active!: boolean;
    @Column() ip?: string;
    @Column({type: "json"}) data?: ISessionData;
    @Column({type: "boolean", default: false}) isPlayerExcluded!: boolean;

    static async init(playerId: string, token: string, key: string, provider?: string, game?: string, data?: any, ip?: string, isPlayerExcluded?: boolean): Promise<Session> {
        let session: Session;
        await getConnection("primary").transaction(async manager => {
            await manager.findOne(Session, {where: {playerId, provider, game}, lock: {mode: "pessimistic_write"}}); //lock
            await manager.update(Session, {playerId, provider, game, active: true}, {active: false, endedAt: new Date()});
            session = await manager.save(Session, {playerId, token, key, provider, game, ip: anonymiseIp(ip), data, lastActivity: new Date(), active: true, isPlayerExcluded});
        });
        return session!;
    }

    static async getAndProlong(playerId: string, provider: string | undefined, game: string | undefined, prolong: boolean, sessionExpiryMinutes: number | undefined): Promise<ISession> {
        const session = await Session.findOne({where: {playerId, provider, game}, order: {lastActivity: "DESC"}});
        if (!session) throw new Exception("Couldn't find a session", {data: {playerId, provider, game}});

        const sessionId = session.sessionId;
        if (prolong && session.active) {
            await Session.update({sessionId}, {lastActivity: new Date()});

            if (sessionExpiryMinutes !== undefined) {
                const expiryTime = Date.now() + sessionExpiryMinutes * 60 * 1000;
                await scheduleTask("endSession", sessionId, expiryTime, {sessionId});
            }
        }
        return this.toData(session);
    }

    static async get(sessionId: string) {
        const session = await Session.findOneBy({sessionId});
        if (!session) return null;
        return this.toData(session);
    }

    private static toData(session: Session) {
        return {token: session.token, active: session.active, sessionId: session.sessionId, data: session.data, isPlayerExcluded: session.isPlayerExcluded};
    }

    static async getCachedSession(key: string, provider: string, game: string, keyCacheExpiry?: number) {
        if (keyCacheExpiry != null) {
            const session = await Session.findOneBy({key, provider, game, active: true});
            if (session && Date.now() - session.createdAt!.getTime() < keyCacheExpiry * 1000) {
                return {sessionId: session.sessionId, sessionData: session.data, playerId: session.playerId};
            }
        }
    }
}

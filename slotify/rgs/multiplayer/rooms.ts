import {Room} from "../db/model/Room";
import {getConnectionsPerRoom} from "./websocket";
import {ISettingsFilter, Settings} from "../db/model/Settings";

export async function rooms(provider: string, game: string, currency: string, wallet: string, operator: string, brand?: string, jurisdiction?: string): Promise<{rooms: {roomId: string}[]}> {
    const connections = await getConnectionsPerRoom();

    const settingsFilter: ISettingsFilter = {provider, game, currency, wallet, operator, brand, jurisdiction};
    const variant = (await Settings.getValues(settingsFilter)).gameVariant;

    const rooms = (await Room.getRooms())
        .filter(room => room.deletedAt === null)
        .filter(room => room.provider === provider && room.game === game)
        .filter(room => room.enabled)
        .filter(room => !room.provablyFair || room.provablyFair.seed)
        .filter(room => !room.currencies || room.currencies.includes(currency))
        .filter(room => !room.wallets || room.wallets.includes(wallet))
        .filter(room => !room.operators || room.operators.includes(operator))
        .filter(room => !room.brands || (brand && room.brands.includes(brand)))
        .filter(room => !room.variant || room.variant === variant)
        .map(({roomId, config, provider, game, name, provablyFair}) => ({name, provider, game, config, roomId, connections: connections[roomId] || 0, provablyFair: !!provablyFair}));

    return {rooms};
}

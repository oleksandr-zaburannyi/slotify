import {fetchAndParse} from "@slotify/shared/lib/fetch";
import {gamesService} from "../util/gamesUtil";

export default async function proveFairness(provider: string, game: string, params: {serverSeed: string; clientSeed: string; nonce: number; hash: string; seed: string}, data: any) {
    const {serverSeed, clientSeed, nonce, hash, seed} = params;
    if (serverSeed && clientSeed && nonce != null) {
        return await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/proveFairness?serverSeed=${serverSeed}&clientSeed=${clientSeed}&nonce=${nonce}` + (data ? `&data=${data}` : ""));
    }
    return await fetchAndParse(`${await gamesService(provider, game)}/api/games/${game}/proveFairness?hash=${hash}&seed=${seed}` + (data ? `&data=${data}` : ""));
}

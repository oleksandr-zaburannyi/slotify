import {getPrometheusRegistry, sanitizeLabelValue} from "@slotify/shared/lib/metrics";
import {Counter, Gauge, Histogram} from "prom-client";
import Exception from "@slotify/shared/lib/Exception";

const recentPlayers = new Set<string>();

let activePlayersGauge: Gauge<string>;

let totalBetsCounter: Counter<string>;

let payoutMultiplierHistogram: Histogram<string>;

export function initRgsMetrics() {
    const registry = getPrometheusRegistry();

    activePlayersGauge = new Gauge({
        name: "active_players_total",
        help: "Number of unique players seen within the past minute (per instance)",
        registers: [registry],
    });

    totalBetsCounter = new Counter({
        name: "total_bets",
        help: "Total number of bets placed on the platform",
        labelNames: ["game", "currency", "provider", "operator"],
        registers: [registry],
    });

    payoutMultiplierHistogram = new Histogram({
        name: "payout_multiplier_ratio",
        help: "Distribution of win/loss multipliers",
        labelNames: ["game", "provider", "operator"],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 1000],
        registers: [registry],
    });

    startIntervals();
}

export const serviceMetrics = {
    registerPlayerId: (playerId: string) => {
        if (playerId) {
            recentPlayers.add(playerId);
        }
    },
    recordRoundPayout: (winRatio: number | null, game: string, provider: string, operator: string) => {
        if (!payoutMultiplierHistogram) throw new Exception("Metrics are not initialized");

        payoutMultiplierHistogram.observe(
            {
                game: sanitizeLabelValue(game),
                provider: sanitizeLabelValue(provider),
                operator: sanitizeLabelValue(operator),
            },
            winRatio ?? 0,
        );
    },
    recordBet: (game: string, currency: string, provider: string, operator: string) => {
        if (!totalBetsCounter) throw new Exception("Metrics are not initialized");

        totalBetsCounter.inc({
            game: sanitizeLabelValue(game),
            currency: sanitizeLabelValue(currency),
            provider: sanitizeLabelValue(provider),
            operator: sanitizeLabelValue(operator),
        });
    },
};

let metricIntervals: NodeJS.Timeout[] = [];

function startIntervals() {
    const activePlayersFlushInterval = setInterval(() => {
        if (!activePlayersGauge) throw new Exception("Metrics are not initialized");

        activePlayersGauge.set(recentPlayers.size);
        recentPlayers.clear();
    }, 30_000);

    metricIntervals.push(activePlayersFlushInterval);
}

export function stopIntervals() {
    metricIntervals.forEach(interval => clearInterval(interval));
    metricIntervals = [];
}

process.on("SIGTERM", () => {
    stopIntervals();
});

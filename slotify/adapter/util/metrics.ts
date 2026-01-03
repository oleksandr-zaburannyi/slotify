import {Counter, Histogram} from "prom-client";
import {getPrometheusRegistry, sanitizeLabelValue} from "@slotify/shared/lib/metrics";

let transactionsFailedCounter: Counter<string>;

let transactionsFinishedCounter: Counter<string>;

let transactionLatencyHistogram: Histogram<string>;

export function initAdapterMetrics() {
    const registry = getPrometheusRegistry();

    transactionsFailedCounter = new Counter({
        name: "failed_transactions_total",
        help: "Number of failed transactions",
        labelNames: ["game", "reason", "wallet", "error", "operator", "message", "code", "brand"],
        registers: [registry],
    });

    transactionsFinishedCounter = new Counter({
        name: "finished_transactions_total",
        help: "Number of successfully finished transactions",
        labelNames: ["game", "wallet", "operator", "brand"],
        registers: [registry],
    });

    transactionLatencyHistogram = new Histogram({
        name: "transaction_duration_milliseconds",
        help: "Duration of Transaction in milliseconds",
        labelNames: ["wallet"],
        buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
        registers: [registry],
    });
}

export const serviceMetrics = {
    updateFailedTransactionsCounter: (game: string, reason: string, wallet: string, error: string, operator: string, code: string, brand: string = "unknown_brand") => {
        transactionsFailedCounter.inc({
            game: sanitizeLabelValue(game),
            reason: sanitizeLabelValue(reason),
            wallet: sanitizeLabelValue(wallet),
            error: sanitizeLabelValue(error),
            operator: sanitizeLabelValue(operator),
            code: sanitizeLabelValue(code),
            brand: sanitizeLabelValue(brand),
        });
    },
    updateFinishedTransactionCounter: (game: string, wallet: string, operator: string, brand: string = "unknown_brand") => {
        transactionsFinishedCounter.inc({
            game: sanitizeLabelValue(game),
            wallet: sanitizeLabelValue(wallet),
            operator: sanitizeLabelValue(operator),
            brand: sanitizeLabelValue(brand),
        });
    },
    addTransactionLatencyToHistogram: (latency: number, wallet: string) => {
        transactionLatencyHistogram.observe(
            {
                wallet: sanitizeLabelValue(wallet),
            },
            latency,
        );
    },
};

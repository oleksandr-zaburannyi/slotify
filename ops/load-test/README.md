# Load test

The script simulates users making 100 spins each on random games with random actions and random bets.

## Installation

Install k6s: https://k6.io/docs/getting-started/installation/

Install node modules: `npm i`

## Run

```bash
URL=https://test.tequity.ventures #path to server instance
npm run load
```

## Run in cloud

```bash
URL=https://test.tequity.ventures #path to server instance
npm run load:cloud
```
# Paper-Trading Forward Tester

A single-shot forward tester that **reuses the exact strategy code** from the
backtester. It imports `Strategy` / `SmaCrossover` from `strategy.py` and the
metrics from `metrics.py` — the trading logic is never reimplemented, so
forward results are directly comparable to the backtest.

## Files

| File | Responsibility |
|------|---------------|
| `broker_paper.py` | `PaperBroker` — simulated account: cash, positions, trade log, same cost model as the backtester. Serializes to `state.json`. |
| `runner.py` | The live loop. Runs **once per invocation** (cron-friendly, not an infinite loop). Fetches latest bars, gets the signal, trades, logs, saves state. |
| `report.py` | Reads `log.csv` + `state.json`, computes the **same metrics** as `metrics.py`. |

Runtime artifacts (gitignored):
- `state.json` — full broker state, persists between runs.
- `log.csv` — one timestamped row per invocation (the forward equity curve).

## Quick start

```bash
cd backtester
pip install -r requirements.txt

python runner.py     # one trading day's decision
python report.py     # performance so far
```

Each `runner.py` call prints a one-line status, e.g.:

```
[2026-06-04T20:05:00+00:00] SPY bar=2026-06-04 price=531.20 signal=1 -> LONG | BUY 18.7654 @ 531.86 | equity=$9,981.34
```

## Configuration

All knobs are at the top of `runner.py`:

```python
TICKER          = "SPY"
INITIAL_CAPITAL = 10_000.0
COMMISSION      = 0.001     # 0.10 % per side — same as backtester
SLIPPAGE        = 0.0005    # 0.05 % per side — same as backtester
STRATEGY        = SmaCrossover(fast=50, slow=200)
LOOKBACK        = "2y"      # enough history to warm up SMA(200)
```

To forward-test a different strategy, import your `Strategy` subclass and
assign it to `STRATEGY` — exactly the same class you backtested.

## No look-ahead — how to verify

Two clearly-commented spots in `runner.py`:

1. **Signal**: `STRATEGY.generate_signals(df)` runs over the full history of
   **closed** bars; we read `signals.iloc[-1]` — the decision from the most
   recent closed bar. `df` contains no future bar.
2. **Execution price** (`*** REAL-TIME PRICE USED HERE ***`): we transact at
   `df["close"].iloc[-1]`, the latest real observed price — never a future one.

Because the script is single-shot and only ever sees data up to "now", it
physically cannot read future bars.

## Scheduling with cron (Linux / macOS)

Run once each weekday shortly after the US market close (16:00 ET).
Edit your crontab:

```bash
crontab -e
```

Add a line (adjust the path and Python interpreter to your machine). This runs
at 16:10 on weekdays, in the server's local time:

```cron
10 16 * * 1-5 cd /absolute/path/to/backtester && /usr/bin/python3 runner.py >> runner.out 2>&1
```

- `10 16` → 16:10
- `* *` → every day-of-month, every month
- `1-5` → Monday–Friday only

If your machine's clock isn't in US Eastern time, schedule for the equivalent
local time (e.g. `10 22 * * 1-5` for 22:10 CET ≈ 16:10 ET in winter), or set
`CRON_TZ=America/New_York` at the top of the crontab:

```cron
CRON_TZ=America/New_York
10 16 * * 1-5 cd /absolute/path/to/backtester && /usr/bin/python3 runner.py >> runner.out 2>&1
```

### macOS note
`cron` works on macOS but only fires if the machine is awake. For a laptop,
`launchd` (a `.plist` with `StartCalendarInterval`) is more reliable. cron is
fine for an always-on machine or server.

## Resetting the test

Delete the runtime state — the next `runner.py` run starts fresh from
`INITIAL_CAPITAL`:

```bash
rm state.json log.csv
```

## Comparing forward vs. backtest

`report.py` calls the **same** `metrics.compute_metrics` used by the
backtester. Run your backtest (`run.py`) and the forward report (`report.py`)
for the same strategy and compare the metric tables side by side — total
return, CAGR, Sharpe, max drawdown, win rate, profit factor, trade count.
Large divergence usually means the backtest was over-fit or the live cost
assumptions are off.

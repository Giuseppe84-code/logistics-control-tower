"""
runner.py — Paper-trading forward tester. Runs ONCE per invocation.

Designed to be triggered by cron/launchd once per trading day (see README),
NOT to run as an infinite loop.

Flow per invocation:
  1. Load PaperBroker from state.json (or initialize on first run).
  2. Fetch the latest available daily bars via yfinance.
  3. Feed them to the IMPORTED strategy (same code as the backtester) to get
     the current target signal.
  4. Execute any position change through PaperBroker at the latest real price.
  5. Append the decision to log.csv (timestamped).
  6. Save broker state back to state.json.
  7. Print a one-line status.

It reuses strategy.py verbatim — the trading logic is imported, never copied.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

from broker_paper import PaperBroker
# ── Reuse the EXACT strategy code from the backtester (no reimplementation) ──
from strategy import SmaCrossover  # noqa: F401  (swap for any Strategy subclass)

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  CONFIGURATION — edit here                                                ║
# ╚══════════════════════════════════════════════════════════════════════════╝
TICKER = "SPY"
INITIAL_CAPITAL = 10_000.0
COMMISSION = 0.001     # 0.10 % per side  (same as backtester)
SLIPPAGE = 0.0005      # 0.05 % per side  (same as backtester)

# The strategy instance — identical class to the backtest.
STRATEGY = SmaCrossover(fast=50, slow=200)

# How much history to pull so the strategy's slowest indicator is warmed up.
# SMA(200) needs ≥ 200 bars; "2y" of daily data (~500 bars) is comfortable.
LOOKBACK = "2y"

# Schedule assumption: this script is run once per trading day, shortly after
# the close, by cron/launchd (see README). It is intentionally single-shot.

# File locations (next to this script).
HERE = Path(__file__).parent
STATE_FILE = HERE / "state.json"
LOG_FILE = HERE / "log.csv"

LOG_HEADER = ["timestamp", "bar_date", "signal", "action", "price", "position", "equity"]


def fetch_latest_bars(ticker: str, lookback: str):
    """
    Download recent daily OHLCV.

    The most recent row is the latest CLOSED daily bar available from the data
    provider. We never request or use a bar dated in the future.
    """
    df = yf.download(ticker, period=lookback, interval="1d",
                     auto_adjust=True, progress=False)
    if df.empty:
        raise RuntimeError(f"No data returned for {ticker}")
    if hasattr(df.columns, "droplevel") and df.columns.nlevels > 1:
        df.columns = df.columns.droplevel(1)
    df.columns = [c.lower() for c in df.columns]
    df.sort_index(inplace=True)
    return df


def append_log(row: dict) -> None:
    """Append one decision row to log.csv, writing the header on first use."""
    new_file = not LOG_FILE.exists()
    with LOG_FILE.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=LOG_HEADER)
        if new_file:
            writer.writeheader()
        writer.writerow(row)


def main() -> None:
    # ── 1. Load or initialize broker state ────────────────────────────────────
    if STATE_FILE.exists():
        broker = PaperBroker.load(STATE_FILE)
    else:
        broker = PaperBroker(INITIAL_CAPITAL, COMMISSION, SLIPPAGE)

    # ── 2. Fetch latest bars (real, already-closed market data) ───────────────
    df = fetch_latest_bars(TICKER, LOOKBACK)

    # ── 3. Compute the strategy signal on observed data only ──────────────────
    # generate_signals() runs on the full history of CLOSED bars. We take the
    # signal on the LAST row — i.e. the decision implied by the most recent
    # closed bar. No future bar exists in df, so there is no look-ahead.
    signals = STRATEGY.generate_signals(df)
    target_signal = int(signals.iloc[-1])

    # ── 4. Execute at the latest REAL price ───────────────────────────────────
    # *** REAL-TIME PRICE USED HERE ***
    # We execute at the close of the latest available bar. In live forward
    # testing this is the most recent real, observed price — it is NOT a future
    # price. (A signal derived from bar t is acted on at bar t's own close,
    # which is the price you could realistically transact at right after close.)
    latest_price = float(df["close"].iloc[-1])
    bar_date = df.index[-1].date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")

    action = broker.market_order(TICKER, target_signal, latest_price, now_iso)

    # ── 5. Mark-to-market and log the decision ────────────────────────────────
    equity = broker.equity(latest_price)
    append_log({
        "timestamp": now_iso,
        "bar_date": bar_date,
        "signal": target_signal,
        "action": action,
        "price": round(latest_price, 4),
        "position": broker.position_label(),
        "equity": round(equity, 2),
    })

    # ── 6. Persist broker state ───────────────────────────────────────────────
    broker.save(STATE_FILE)

    # ── 7. One-line status ────────────────────────────────────────────────────
    print(f"[{now_iso}] {TICKER} bar={bar_date} price={latest_price:.2f} "
          f"signal={target_signal} -> {broker.position_label()} "
          f"| {action} | equity=${equity:,.2f}")


if __name__ == "__main__":
    main()

"""
report.py — Forward-test performance report.

Reads log.csv (the equity time-series logged by runner.py) and the trade log
inside state.json, then computes performance metrics using the SAME function
as the backtester (metrics.compute_metrics). This makes forward results
directly comparable to the backtest.

Usage:
    python report.py
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

# ── Reuse the EXACT metrics code from the backtester (no reimplementation) ──
from metrics import compute_metrics, print_metrics

HERE = Path(__file__).parent
STATE_FILE = HERE / "state.json"
LOG_FILE = HERE / "log.csv"


def build_equity_curve(log_path: Path) -> pd.Series:
    """
    Reconstruct the equity curve from log.csv.

    Each runner invocation appends one row with the marked-to-market equity at
    that bar's price, so the 'equity' column over time IS the forward-test
    equity curve. We index it by bar_date (one point per trading day).
    """
    df = pd.read_csv(log_path)
    df["bar_date"] = pd.to_datetime(df["bar_date"])
    # If a day was logged more than once (e.g. manual re-run), keep the last.
    df = df.drop_duplicates(subset="bar_date", keep="last")
    df.set_index("bar_date", inplace=True)
    df.sort_index(inplace=True)
    return df["equity"].astype(float)


def main() -> None:
    if not LOG_FILE.exists() or not STATE_FILE.exists():
        print("No forward-test data yet. Run runner.py at least once first.")
        return

    equity = build_equity_curve(LOG_FILE)
    if len(equity) < 2:
        print(f"Only {len(equity)} data point(s) logged so far — need at least 2 "
              "to compute returns. Keep running runner.py daily.")
        return

    state = json.loads(STATE_FILE.read_text())
    trade_log = state["trade_log"]
    initial_capital = state["initial_capital"]

    # Same metrics function the backtester uses → apples-to-apples comparison.
    metrics = compute_metrics(equity, trade_log, initial_capital)

    print("\n=== FORWARD (PAPER) TEST REPORT ===")
    print(f"Logged trading days: {len(equity)}")
    print_metrics(metrics)
    print("Compare these against your backtest's metrics.py output for the "
          "same strategy to see how forward performance tracks the backtest.\n")


if __name__ == "__main__":
    main()

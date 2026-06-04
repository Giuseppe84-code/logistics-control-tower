"""
metrics.py — Performance metrics derived from the equity curve and trade log.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def compute_metrics(
    equity: pd.Series,
    trade_log: list[dict],
    initial_capital: float,
) -> dict:
    """
    Compute a standard set of backtest performance metrics.

    Parameters
    ----------
    equity          : Daily equity curve (pd.Series with DatetimeIndex).
    trade_log       : List of completed trade dicts from engine.run_backtest().
    initial_capital : Starting capital used in the backtest.

    Returns
    -------
    Ordered dict of metric name → value (already rounded).
    """
    start = equity.index[0]
    end = equity.index[-1]
    n_years = (end - start).days / 365.25

    # ── Returns ───────────────────────────────────────────────────────────────
    total_return_pct = (equity.iloc[-1] / initial_capital - 1.0) * 100.0
    cagr_pct = ((equity.iloc[-1] / initial_capital) ** (1.0 / n_years) - 1.0) * 100.0

    # ── Risk ──────────────────────────────────────────────────────────────────
    daily_rets = equity.pct_change().dropna()
    sharpe = float("nan")
    if daily_rets.std() > 0:
        # Annualise assuming 252 trading days; risk-free rate = 0.
        sharpe = (daily_rets.mean() / daily_rets.std()) * np.sqrt(252)

    rolling_peak = equity.cummax()
    drawdown = (equity - rolling_peak) / rolling_peak
    max_dd_pct = drawdown.min() * 100.0

    # ── Trade statistics ──────────────────────────────────────────────────────
    n_trades = len(trade_log)
    win_rate = profit_factor = avg_trade_pnl = float("nan")

    if n_trades > 0:
        pnls = [t["pnl"] for t in trade_log]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p <= 0]

        win_rate = len(wins) / n_trades * 100.0
        avg_trade_pnl = sum(pnls) / n_trades

        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    return {
        "Period": f"{start.date()} → {end.date()}",
        "Initial Capital ($)": round(initial_capital, 2),
        "Final Equity ($)": round(float(equity.iloc[-1]), 2),
        "Total Return (%)": round(total_return_pct, 2),
        "CAGR (%)": round(cagr_pct, 2),
        "Sharpe Ratio": round(sharpe, 3),
        "Max Drawdown (%)": round(max_dd_pct, 2),
        "Num Trades": n_trades,
        "Win Rate (%)": round(win_rate, 2),
        "Profit Factor": round(profit_factor, 3),
        "Avg Trade PnL ($)": round(avg_trade_pnl, 2),
    }


def print_metrics(metrics: dict) -> None:
    """Pretty-print the metrics dict as a table."""
    width = 46
    print()
    print("╔" + "═" * width + "╗")
    print("║{:^{w}}║".format("  BACKTEST RESULTS  ", w=width))
    print("╠" + "═" * width + "╣")
    for key, val in metrics.items():
        print("║  {:<26}{:>16}  ║".format(key, str(val)))
    print("╚" + "═" * width + "╝")
    print()

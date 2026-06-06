"""
plot.py — Visualise backtest results.

Two-panel layout:
  Top    : equity curve with entry (▲) and exit (▼) markers.
  Bottom : underwater equity / drawdown chart.
"""

from __future__ import annotations

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd


def plot_results(
    equity: pd.Series,
    trade_log: list[dict],
    title: str = "Backtest Results",
    save_path: str | None = "backtest_results.png",
) -> None:
    """
    Parameters
    ----------
    equity     : Daily equity curve from engine.run_backtest().
    trade_log  : Completed trade list from engine.run_backtest().
    title      : Figure suptitle.
    save_path  : If given, save PNG to this path; also calls plt.show().
    """
    fig, (ax_eq, ax_dd) = plt.subplots(
        2, 1,
        figsize=(14, 8),
        sharex=True,
        gridspec_kw={"height_ratios": [3, 1]},
    )
    fig.suptitle(title, fontsize=14, fontweight="bold", y=0.98)

    # ── Top panel: equity curve ───────────────────────────────────────────────
    ax_eq.plot(equity.index, equity.values, color="#2563EB", linewidth=1.5,
               label="Portfolio Equity", zorder=2)

    # Shade the area under the curve
    ax_eq.fill_between(equity.index, equity.values, equity.values.min(),
                       alpha=0.06, color="#2563EB")

    # Entry / exit markers from trade log
    for trade in trade_log:
        entry_dt = trade["entry_date"]
        exit_dt = trade["exit_date"]

        # Only mark if the date exists in the equity index
        if entry_dt in equity.index:
            ax_eq.scatter(
                entry_dt, equity[entry_dt],
                marker="^", color="#16A34A", s=80, zorder=5,
                label="Entry" if trade is trade_log[0] else "",
            )
        if exit_dt in equity.index:
            ax_eq.scatter(
                exit_dt, equity[exit_dt],
                marker="v", color="#DC2626", s=80, zorder=5,
                label="Exit" if trade is trade_log[0] else "",
            )

    ax_eq.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x:,.0f}"))
    ax_eq.set_ylabel("Portfolio Value", fontsize=10)
    ax_eq.grid(True, alpha=0.25)
    ax_eq.legend(fontsize=9, loc="upper left")

    # ── Bottom panel: drawdown ────────────────────────────────────────────────
    rolling_peak = equity.cummax()
    drawdown_pct = (equity - rolling_peak) / rolling_peak * 100.0

    ax_dd.fill_between(drawdown_pct.index, drawdown_pct.values, 0,
                       color="#DC2626", alpha=0.45, label="Drawdown")
    ax_dd.plot(drawdown_pct.index, drawdown_pct.values, color="#DC2626",
               linewidth=0.8)

    max_dd_idx = drawdown_pct.idxmin()
    max_dd_val = drawdown_pct.min()
    ax_dd.annotate(
        f"{max_dd_val:.1f}%",
        xy=(max_dd_idx, max_dd_val),
        xytext=(10, -15),
        textcoords="offset points",
        fontsize=8,
        color="#DC2626",
        arrowprops=dict(arrowstyle="->", color="#DC2626", lw=0.8),
    )

    ax_dd.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}%"))
    ax_dd.set_ylabel("Drawdown", fontsize=10)
    ax_dd.set_xlabel("Date", fontsize=10)
    ax_dd.grid(True, alpha=0.25)
    ax_dd.legend(fontsize=9, loc="lower left")

    # Shared x-axis formatting
    ax_dd.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax_dd.xaxis.set_major_locator(mdates.YearLocator())
    fig.autofmt_xdate(rotation=0, ha="center")

    plt.tight_layout()

    if save_path:
        fig.savefig(save_path, dpi=150, bbox_inches="tight")
        print(f"[plot] Saved to {save_path}")

    plt.show()

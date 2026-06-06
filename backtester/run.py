"""
run.py — Entry point: wire data → strategy → engine → metrics → plot.

All user-configurable parameters are at the top of this file.
"""

from data import get_data
from engine import run_backtest
from metrics import compute_metrics, print_metrics
from plot import plot_results
from strategy import SmaCrossover

# ── Configuration ─────────────────────────────────────────────────────────────

TICKER = "SPY"
START = "2010-01-01"
END = "2024-01-01"

INITIAL_CAPITAL: float = 10_000.0
COMMISSION: float = 0.001    # 0.10 % per side (round-turn = 0.20 %)
SLIPPAGE: float = 0.0005     # 0.05 % per side (round-turn = 0.10 %)

# ── Strategy ──────────────────────────────────────────────────────────────────
# Swap this for any other Strategy subclass defined in strategy.py.

strategy = SmaCrossover(fast=50, slow=200)

# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\nRunning backtest: {strategy} on {TICKER} ({START} → {END})")
    print(f"Capital: ${INITIAL_CAPITAL:,.0f}  |  "
          f"Commission: {COMMISSION*100:.2f}%  |  "
          f"Slippage: {SLIPPAGE*100:.3f}%\n")

    df = get_data(TICKER, START, END)

    equity, trade_log = run_backtest(
        df,
        strategy,
        initial_capital=INITIAL_CAPITAL,
        commission=COMMISSION,
        slippage=SLIPPAGE,
    )

    metrics = compute_metrics(equity, trade_log, INITIAL_CAPITAL)
    print_metrics(metrics)

    plot_results(
        equity,
        trade_log,
        title=f"{strategy} — {TICKER} ({START} → {END})",
        save_path="backtest_results.png",
    )

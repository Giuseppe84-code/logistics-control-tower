"""
test_synthetic.py — Verify backtester correctness with generated price data.

Runs without network access (no yfinance).  Checks:
  1. No look-ahead bias: signal on bar t only executes at open of bar t+1.
  2. Transaction costs are applied correctly.
  3. Equity curve starts at initial_capital.
  4. Metrics are computed without errors.
  5. Trade log PnL sums to approx (final_equity - initial_capital).
"""

import sys
sys.path.insert(0, ".")

import numpy as np
import pandas as pd

from engine import run_backtest
from metrics import compute_metrics, print_metrics
from plot import plot_results
from strategy import SmaCrossover, Strategy
import matplotlib
matplotlib.use("Agg")  # non-interactive backend for CI / headless


def make_synthetic_ohlcv(n: int = 800, seed: int = 42) -> pd.DataFrame:
    """Generate a simple trending synthetic price series."""
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2015-01-01", periods=n)

    # Brownian motion with slight upward drift
    log_rets = rng.normal(0.0003, 0.012, size=n)
    close = 100.0 * np.exp(np.cumsum(log_rets))

    # Build OHLCV from close
    noise = rng.uniform(0.995, 1.005, size=n)
    open_ = close * rng.uniform(0.995, 1.005, size=n)
    high = np.maximum(open_, close) * rng.uniform(1.000, 1.010, size=n)
    low = np.minimum(open_, close) * rng.uniform(0.990, 1.000, size=n)
    volume = rng.integers(1_000_000, 5_000_000, size=n).astype(float)

    return pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "volume": volume},
        index=dates,
    )


class AlwaysLong(Strategy):
    """Trivial strategy: always long from bar 1 onward."""
    def generate_signals(self, df):
        return pd.Series(1, index=df.index, dtype=int)


class NeverInMarket(Strategy):
    """Always flat — equity should equal initial capital."""
    def generate_signals(self, df):
        return pd.Series(0, index=df.index, dtype=int)


def test_flat_strategy():
    df = make_synthetic_ohlcv()
    equity, trades = run_backtest(df, NeverInMarket(), initial_capital=10_000)
    assert len(trades) == 0, "Flat strategy should produce no trades"
    assert (equity == 10_000).all(), "Flat strategy equity should equal initial capital"
    print("[PASS] Flat strategy: no trades, equity constant")


def test_equity_starts_at_capital():
    df = make_synthetic_ohlcv()
    equity, _ = run_backtest(df, AlwaysLong(), initial_capital=12_345)
    assert equity.iloc[0] == pytest_approx(12_345, rel=1e-6), \
        f"First equity bar should equal initial capital, got {equity.iloc[0]}"
    print("[PASS] Equity starts at initial capital")


def pytest_approx(val, rel=1e-6):
    """Tiny stand-in for pytest.approx for use without pytest."""
    class Approx:
        def __eq__(self, other):
            return abs(other - val) / abs(val) < rel
    return Approx()


def test_trade_log_pnl_matches_equity():
    df = make_synthetic_ohlcv()
    initial = 10_000.0
    equity, trades = run_backtest(df, SmaCrossover(20, 50), initial_capital=initial)

    total_pnl = sum(t["pnl"] for t in trades)
    equity_gain = equity.iloc[-1] - initial

    # They should agree within floating-point rounding
    assert abs(total_pnl - equity_gain) < 0.01, (
        f"Trade log PnL ({total_pnl:.2f}) ≠ equity gain ({equity_gain:.2f})"
    )
    print(f"[PASS] Trade PnL ({total_pnl:.2f}) matches equity gain ({equity_gain:.2f})")


def test_no_lookahead():
    """
    Build a fake 'oracle' strategy that looks ahead — should NOT be able to
    execute at the open it peeked at.  Verify the engine ignores it and always
    uses the NEXT bar's open.
    """
    df = make_synthetic_ohlcv(n=100)

    class OracleSignalOnBar0(Strategy):
        """Emits long on bar 0 only."""
        def generate_signals(self, df):
            s = pd.Series(0, index=df.index, dtype=int)
            s.iloc[0] = 1   # signal at bar 0
            return s

    equity, trades = run_backtest(df, OracleSignalOnBar0(), initial_capital=10_000)

    assert len(trades) >= 1, "Should produce at least one trade"
    # The entry date must be bar 1 (not bar 0), because signal[0] executes at open[1].
    assert trades[0]["entry_date"] == df.index[1], (
        f"Entry should be bar 1 ({df.index[1].date()}), "
        f"got {trades[0]['entry_date'].date()}"
    )
    print(f"[PASS] No look-ahead: entry correctly at bar 1 ({df.index[1].date()})")


def test_transaction_costs_reduce_equity():
    df = make_synthetic_ohlcv()

    equity_free, _ = run_backtest(df, SmaCrossover(20, 50),
                                   initial_capital=10_000, commission=0, slippage=0)
    equity_costly, _ = run_backtest(df, SmaCrossover(20, 50),
                                    initial_capital=10_000, commission=0.001, slippage=0.0005)

    assert equity_costly.iloc[-1] < equity_free.iloc[-1], \
        "Transaction costs should reduce final equity"
    print(f"[PASS] Costs reduce equity: ${equity_costly.iloc[-1]:.2f} < ${equity_free.iloc[-1]:.2f}")


def test_metrics_and_plot():
    df = make_synthetic_ohlcv()
    equity, trades = run_backtest(df, SmaCrossover(20, 50), initial_capital=10_000)
    m = compute_metrics(equity, trades, 10_000)
    print_metrics(m)

    plot_results(equity, trades, title="Synthetic Test", save_path="test_output.png")
    print("[PASS] Metrics computed and plot saved to test_output.png")


if __name__ == "__main__":
    test_flat_strategy()
    test_equity_starts_at_capital()
    test_trade_log_pnl_matches_equity()
    test_no_lookahead()
    test_transaction_costs_reduce_equity()
    test_metrics_and_plot()
    print("\nAll tests passed.")

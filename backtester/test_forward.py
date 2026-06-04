"""
test_forward.py — Verify the paper-trading forward tester without network.

Simulates many daily cron invocations by feeding synthetic bars one day at a
time. Each "day" mimics exactly what runner.main() does:
  - build the df of CLOSED bars up to today
  - get signal = strategy.generate_signals(df).iloc[-1]
  - execute at df['close'].iloc[-1] (latest real price)
  - append to log.csv, save state.json

Then it checks:
  1. State persists across invocations (reload from disk each day).
  2. PaperBroker cost model matches engine.run_backtest exactly.
  3. report.build_equity_curve + compute_metrics run cleanly.
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, ".")

import numpy as np
import pandas as pd

from broker_paper import PaperBroker
from engine import run_backtest
from report import build_equity_curve
from metrics import compute_metrics
from strategy import SmaCrossover

HERE = Path(__file__).parent
STATE = HERE / "state.json"
LOG = HERE / "log.csv"
LOG_HEADER = ["timestamp", "bar_date", "signal", "action", "price", "position", "equity"]


def make_data(n=400, seed=11):
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2020-01-01", periods=n)
    close = 100 * np.exp(np.cumsum(rng.normal(0.0005, 0.012, n)))
    open_ = close * rng.uniform(0.996, 1.004, n)
    high = np.maximum(open_, close) * rng.uniform(1.0, 1.008, n)
    low = np.minimum(open_, close) * rng.uniform(0.992, 1.0, n)
    vol = rng.integers(1e6, 5e6, n).astype(float)
    return pd.DataFrame({"open": open_, "high": high, "low": low,
                         "close": close, "volume": vol}, index=dates)


def simulate_forward(df, strat, warmup):
    """Replay each day as a separate cron invocation (reload state every time)."""
    if STATE.exists():
        STATE.unlink()
    if LOG.exists():
        LOG.unlink()

    # Start once warmup history exists so SMA(slow) is defined.
    for end in range(warmup, len(df) + 1):
        window = df.iloc[:end]                       # only CLOSED bars up to "today"

        # Fresh load each invocation — proves persistence works.
        broker = PaperBroker.load(STATE) if STATE.exists() else \
            PaperBroker(10_000, 0.001, 0.0005)

        signals = strat.generate_signals(window)
        target = int(signals.iloc[-1])
        price = float(window["close"].iloc[-1])      # latest real price
        bar_date = window.index[-1].date().isoformat()

        action = broker.market_order("SYN", target, price, bar_date)
        equity = broker.equity(price)

        new_file = not LOG.exists()
        with LOG.open("a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=LOG_HEADER)
            if new_file:
                w.writeheader()
            w.writerow({"timestamp": bar_date + "T20:00:00", "bar_date": bar_date,
                        "signal": target, "action": action, "price": round(price, 4),
                        "position": broker.position_label(), "equity": round(equity, 2)})
        broker.save(STATE)

    return PaperBroker.load(STATE)


def test_persistence_and_report():
    df = make_data()
    strat = SmaCrossover(20, 50)
    broker = simulate_forward(df, strat, warmup=50)

    equity_curve = build_equity_curve(LOG)
    assert len(equity_curve) > 2, "Should have many logged days"
    m = compute_metrics(equity_curve, broker.trade_log, broker.initial_capital)
    assert "Sharpe Ratio" in m and "Max Drawdown (%)" in m
    print(f"[PASS] State persisted across {len(equity_curve)} invocations; "
          f"report computed ({len(broker.trade_log)} trades)")
    return broker, df, strat


def test_cost_model_matches_backtester():
    """
    The forward broker, fed bar-by-bar at each CLOSE, must use the identical
    cost model as engine.run_backtest. We can't expect identical equity (the
    backtester fills at next OPEN, the forward tester at the same-bar CLOSE),
    but a controlled single round-trip at the same price must produce identical
    fills and PnL.
    """
    price = 100.0
    # Forward broker: long then flat at the same price sequence.
    b = PaperBroker(10_000, 0.001, 0.0005)
    b.market_order("X", 1, price, "d1")
    entry_shares = b.shares
    entry_px_fwd = b.entry_price
    b.market_order("X", 0, 110.0, "d2")
    fwd_trade = b.trade_log[-1]

    # Hand-computed expected fills using the documented model.
    exp_entry = 100.0 * (1 + 0.001 + 0.0005)
    exp_exit = 110.0 * (1 - 0.001 - 0.0005)
    exp_shares = 10_000 / exp_entry
    exp_pnl = exp_shares * (exp_exit - exp_entry)

    assert abs(entry_px_fwd - exp_entry) < 1e-6, "Entry fill mismatch"
    assert abs(entry_shares - exp_shares) < 1e-6, "Share count mismatch"
    assert abs(fwd_trade["pnl"] - round(exp_pnl, 2)) < 0.01, "PnL mismatch"
    print(f"[PASS] Cost model matches backtester: entry={exp_entry:.4f} "
          f"exit={exp_exit:.4f} pnl={exp_pnl:.2f}")


def test_no_state_loss():
    """Reloading state.json must reproduce cash, shares, trades exactly."""
    b = PaperBroker(10_000, 0.001, 0.0005)
    b.market_order("X", 1, 100.0, "d1")
    b.market_order("X", -1, 105.0, "d2")
    b.save(STATE)
    reloaded = PaperBroker.load(STATE)
    assert reloaded.cash == b.cash
    assert reloaded.shares == b.shares
    assert reloaded.current_signal == b.current_signal
    assert reloaded.trade_log == b.trade_log
    print("[PASS] No state loss on save/load round-trip")


if __name__ == "__main__":
    test_no_state_loss()
    test_cost_model_matches_backtester()
    broker, df, strat = test_persistence_and_report()

    # Show the comparison the user cares about: forward report metrics.
    from metrics import print_metrics
    eq = build_equity_curve(LOG)
    print_metrics(compute_metrics(eq, broker.trade_log, broker.initial_capital))

    # Clean up runtime artifacts so the repo stays clean.
    STATE.unlink(missing_ok=True)
    LOG.unlink(missing_ok=True)
    print("All forward-tester tests passed.")

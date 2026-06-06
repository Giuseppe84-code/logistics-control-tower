"""
engine.py — Event-driven bar-by-bar backtesting engine.

Design contract (look-ahead bias prevention)
─────────────────────────────────────────────
  Bar i-1 close  →  signal computed (strategy.generate_signals)
  Bar i   open   →  signal EXECUTED (order filled here)
  Bar i   close  →  portfolio marked-to-market (equity recorded here)

The key invariant is enforced in the main loop:

    pending_signal = signals.iloc[i - 1]   # ← yesterday's signal
    open_px        = df.iloc[i]["open"]     # ← today's open (execution price)

We never touch signals.iloc[i] or df.iloc[i]["close"] during the execution
phase.  The close is only read afterward, purely for valuation.

Transaction costs
─────────────────
  Long  entry : effective_price = open × (1 + commission + slippage)
  Long  exit  : effective_price = open × (1 - commission - slippage)
  Short entry : effective_price = open × (1 - commission - slippage)  (we receive less)
  Short exit  : effective_price = open × (1 + commission + slippage)  (we pay more)

Position accounting
───────────────────
  `shares` > 0  →  long
  `shares` < 0  →  short
  `shares` == 0 →  flat

  Equity at any bar = cash + shares × close_price

  For shorts the cash balance includes the short-sale proceeds, so
  equity = cash (large) + shares (negative) × close correctly decreases
  as price rises — no special-casing needed.

Trade log fields
────────────────
  entry_date, exit_date, direction ('long'/'short'),
  entry_price, exit_price, shares (always positive),
  pnl ($), return_pct (%).
"""

from __future__ import annotations

import pandas as pd
from strategy import Strategy


def run_backtest(
    df: pd.DataFrame,
    strategy: Strategy,
    initial_capital: float = 10_000.0,
    commission: float = 0.001,   # 0.10 % per side
    slippage: float = 0.0005,    # 0.05 % per side
) -> tuple[pd.Series, list[dict]]:
    """
    Run a full bar-by-bar backtest.

    Parameters
    ----------
    df               : OHLCV DataFrame (columns: open, high, low, close, volume).
    strategy         : Any Strategy subclass.
    initial_capital  : Starting cash in account currency.
    commission       : One-way commission as a fraction (0.001 = 0.1 %).
    slippage         : One-way slippage as a fraction (0.0005 = 0.05 %).

    Returns
    -------
    equity_curve : pd.Series — portfolio value at each bar's close.
    trade_log    : list[dict] — one entry per completed round-trip.
    """
    # ── Compute all signals up-front ──────────────────────────────────────────
    # signals[t] is based on data through close of bar t.
    # It is safe to compute them all now because the *execution* still happens
    # one bar later (see loop below).
    signals: pd.Series = strategy.generate_signals(df)

    # ── State variables ───────────────────────────────────────────────────────
    cash: float = float(initial_capital)
    shares: float = 0.0       # positive = long, negative = short
    current_signal: int = 0   # what position we currently hold

    entry_price: float = 0.0
    entry_date: pd.Timestamp | None = None

    equity_values: list[float] = []
    trade_log: list[dict] = []

    # ── Main bar loop ─────────────────────────────────────────────────────────
    for i in range(len(df)):
        date = df.index[i]
        row = df.iloc[i]

        # ── EXECUTION PHASE ───────────────────────────────────────────────────
        # We only act from bar 1 onward; bar 0 has no prior signal.
        if i > 0:
            # Look-ahead prevention: use signal from the PREVIOUS bar's close.
            # Never read signals.iloc[i] here.
            pending_signal: int = int(signals.iloc[i - 1])

            if pending_signal != current_signal:
                # Execute at the OPEN of the current bar — not yesterday's close.
                open_px: float = float(row["open"])

                # ── Step 1: Close existing position (if any) ─────────────────
                if current_signal == 1:
                    # Exit long: sell at open, costs reduce the price received.
                    exit_px = open_px * (1.0 - commission - slippage)
                    pnl = shares * (exit_px - entry_price)
                    ret_pct = pnl / (shares * entry_price) * 100.0
                    cash += shares * exit_px
                    trade_log.append(_make_trade(
                        entry_date, date, "long",
                        entry_price, exit_px, shares, pnl, ret_pct,
                    ))
                    shares = 0.0

                elif current_signal == -1:
                    # Cover short: buy back at open, costs increase the price paid.
                    exit_px = open_px * (1.0 + commission + slippage)
                    # shares < 0; formula gives positive PnL when price fell.
                    pnl = shares * (exit_px - entry_price)
                    ret_pct = pnl / (abs(shares) * entry_price) * 100.0
                    cash += shares * exit_px   # shares negative → cash decreases
                    trade_log.append(_make_trade(
                        entry_date, date, "short",
                        entry_price, exit_px, abs(shares), pnl, ret_pct,
                    ))
                    shares = 0.0

                # ── Step 2: Enter new position ────────────────────────────────
                if pending_signal == 1:
                    # Enter long: buy at open, costs increase the price paid.
                    entry_px = open_px * (1.0 + commission + slippage)
                    shares = cash / entry_px    # use full available capital
                    cash -= shares * entry_px   # cash → ~0 (floating-point noise)
                    entry_price = entry_px
                    entry_date = date

                elif pending_signal == -1:
                    # Enter short: sell at open, costs reduce the price received.
                    # We receive short-sale proceeds; cash increases.
                    entry_px = open_px * (1.0 - commission - slippage)
                    n = cash / entry_px         # shares to short (positive)
                    cash += n * entry_px        # receive proceeds
                    shares = -n                 # mark position as short
                    entry_price = entry_px
                    entry_date = date

                current_signal = pending_signal

        # ── MARK-TO-MARKET PHASE ──────────────────────────────────────────────
        # Portfolio value at the CLOSE of the current bar.
        # This is purely for recording — it does NOT feed back into signals.
        close_px: float = float(row["close"])
        equity_values.append(cash + shares * close_px)

    # ── Force-close any open position at the last bar's close ─────────────────
    # This is a reporting-only liquidation, not a real execution.
    # We use the raw close price (no transaction costs) so that
    # sum(trade_log PnL) == equity.iloc[-1] - initial_capital exactly.
    # The equity curve's last value is already MTM at the same close, so
    # applying costs here would introduce an artificial discrepancy.
    if shares != 0 and entry_date is not None:
        last_close = float(df["close"].iloc[-1])
        last_date = df.index[-1]

        # exit_px = raw close (no costs — reporting liquidation)
        exit_px = last_close
        pnl = shares * (exit_px - entry_price)
        ret_pct = pnl / (abs(shares) * entry_price) * 100.0
        direction = "long" if current_signal == 1 else "short"
        trade_log.append(_make_trade(
            entry_date, last_date, direction,
            entry_price, exit_px, abs(shares), pnl, ret_pct,
        ))

    equity_curve = pd.Series(equity_values, index=df.index, name="equity")
    return equity_curve, trade_log


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_trade(
    entry_date, exit_date, direction,
    entry_price, exit_price, shares, pnl, return_pct,
) -> dict:
    return {
        "entry_date": entry_date,
        "exit_date": exit_date,
        "direction": direction,
        "entry_price": round(entry_price, 4),
        "exit_price": round(exit_price, 4),
        "shares": round(shares, 4),
        "pnl": round(pnl, 2),
        "return_pct": round(return_pct, 3),
    }

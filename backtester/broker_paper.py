"""
broker_paper.py — Simulated brokerage account for forward (paper) trading.

This is the ONLY place that touches money.  It mirrors the cost model and the
position/PnL accounting of engine.py exactly, so forward results are directly
comparable to backtest results.

Transaction costs (identical to the backtester):
  Buy  (long entry / short cover)  : price × (1 + commission + slippage)
  Sell (long exit  / short entry)  : price × (1 - commission - slippage)

Position convention (identical to the backtester):
   1 = long, 0 = flat, -1 = short

State is fully serialized to state.json so nothing is lost between cron runs.
"""

from __future__ import annotations

import json
from pathlib import Path


class PaperBroker:
    def __init__(
        self,
        initial_capital: float = 10_000.0,
        commission: float = 0.001,   # 0.10 % per side
        slippage: float = 0.0005,    # 0.05 % per side
    ):
        self.initial_capital = float(initial_capital)
        self.commission = float(commission)
        self.slippage = float(slippage)

        self.cash: float = float(initial_capital)
        self.shares: float = 0.0          # >0 long, <0 short, 0 flat
        self.current_signal: int = 0       # target position we currently hold

        # Open-position bookkeeping (for building round-trip trades).
        self.entry_price: float = 0.0
        self.entry_date: str | None = None

        self.trade_log: list[dict] = []

    # ── Order execution ─────────────────────────────────────────────────────
    def market_order(
        self,
        ticker: str,
        target_position: int,
        price: float,
        timestamp: str,
    ) -> str:
        """
        Move the account to `target_position` ∈ {-1, 0, 1} at `price`.

        `price` MUST be a real, already-observed market price (see runner.py —
        we use the latest available close). This method never sees future data;
        it only acts on the price handed to it right now.

        Returns a short human-readable description of the action taken.
        """
        if target_position == self.current_signal:
            return "HOLD"

        actions: list[str] = []

        # ── Step 1: close any existing position ───────────────────────────────
        if self.current_signal == 1:
            # Exit long: sell at price, costs reduce the proceeds.
            exit_px = price * (1.0 - self.commission - self.slippage)
            pnl = self.shares * (exit_px - self.entry_price)
            ret_pct = pnl / (self.shares * self.entry_price) * 100.0
            self.cash += self.shares * exit_px
            self._record_trade(timestamp, "long", exit_px, abs(self.shares), pnl, ret_pct)
            actions.append(f"SELL {self.shares:.4f} @ {exit_px:.4f}")
            self.shares = 0.0

        elif self.current_signal == -1:
            # Cover short: buy back at price, costs increase the cost.
            exit_px = price * (1.0 + self.commission + self.slippage)
            pnl = self.shares * (exit_px - self.entry_price)  # shares < 0
            ret_pct = pnl / (abs(self.shares) * self.entry_price) * 100.0
            self.cash += self.shares * exit_px                # shares < 0 → cash down
            self._record_trade(timestamp, "short", exit_px, abs(self.shares), pnl, ret_pct)
            actions.append(f"COVER {abs(self.shares):.4f} @ {exit_px:.4f}")
            self.shares = 0.0

        # ── Step 2: open the new position ─────────────────────────────────────
        if target_position == 1:
            # Enter long: buy at price, costs increase the price paid.
            entry_px = price * (1.0 + self.commission + self.slippage)
            self.shares = self.cash / entry_px        # deploy full available cash
            self.cash -= self.shares * entry_px
            self.entry_price = entry_px
            self.entry_date = timestamp
            actions.append(f"BUY {self.shares:.4f} @ {entry_px:.4f}")

        elif target_position == -1:
            # Enter short: sell at price, costs reduce the proceeds received.
            entry_px = price * (1.0 - self.commission - self.slippage)
            n = self.cash / entry_px                  # shares to short (positive)
            self.cash += n * entry_px                 # receive short proceeds
            self.shares = -n
            self.entry_price = entry_px
            self.entry_date = timestamp
            actions.append(f"SHORT {n:.4f} @ {entry_px:.4f}")

        self.current_signal = target_position
        return " | ".join(actions) if actions else "FLAT"

    # ── Valuation ───────────────────────────────────────────────────────────
    def equity(self, price: float) -> float:
        """Mark-to-market account value at `price` (a real observed price)."""
        return self.cash + self.shares * price

    def position_label(self) -> str:
        return {1: "LONG", 0: "FLAT", -1: "SHORT"}[self.current_signal]

    # ── Trade-log helper (mirrors engine._make_trade) ─────────────────────────
    def _record_trade(self, exit_date, direction, exit_price, shares, pnl, ret_pct):
        self.trade_log.append({
            "entry_date": self.entry_date,
            "exit_date": exit_date,
            "direction": direction,
            "entry_price": round(self.entry_price, 4),
            "exit_price": round(exit_price, 4),
            "shares": round(shares, 4),
            "pnl": round(pnl, 2),
            "return_pct": round(ret_pct, 3),
        })

    # ── Persistence ───────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "initial_capital": self.initial_capital,
            "commission": self.commission,
            "slippage": self.slippage,
            "cash": self.cash,
            "shares": self.shares,
            "current_signal": self.current_signal,
            "entry_price": self.entry_price,
            "entry_date": self.entry_date,
            "trade_log": self.trade_log,
        }

    def save(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), indent=2, default=str))

    @classmethod
    def load(cls, path: str | Path) -> "PaperBroker":
        data = json.loads(Path(path).read_text())
        broker = cls(
            initial_capital=data["initial_capital"],
            commission=data["commission"],
            slippage=data["slippage"],
        )
        broker.cash = data["cash"]
        broker.shares = data["shares"]
        broker.current_signal = data["current_signal"]
        broker.entry_price = data["entry_price"]
        broker.entry_date = data["entry_date"]
        broker.trade_log = data["trade_log"]
        return broker

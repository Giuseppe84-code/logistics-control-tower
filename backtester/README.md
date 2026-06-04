# Python Event-Driven Backtester

A clean, dependency-minimal backtester built from scratch using only
`pandas`, `numpy`, `yfinance`, and `matplotlib`.

## Quick start

```bash
cd backtester
pip install -r requirements.txt
python run.py
```

This downloads SPY (2010–2024), runs an SMA 50/200 crossover strategy,
prints a metrics table, and saves `backtest_results.png`.

---

## Module overview

| File | Responsibility |
|------|---------------|
| `data.py` | Fetch OHLCV from yfinance; cache as Parquet in `.cache/` |
| `strategy.py` | `Strategy` base class + `SmaCrossover` example |
| `engine.py` | Bar-by-bar loop; no look-ahead bias; transaction costs |
| `metrics.py` | Total return, CAGR, Sharpe, max DD, win rate, profit factor |
| `plot.py` | Equity curve with trade markers + drawdown panel |
| `run.py` | Wire-up; all user parameters live here |

---

## How look-ahead bias is prevented

The engine processes bars in order.  At bar `i`:

```
signal  = signals.iloc[i - 1]   # determined at close of bar i-1
exec_px = df.iloc[i]["open"]     # filled at open of bar i  ← no future data
mtm_px  = df.iloc[i]["close"]    # used only for valuation, not decisions
```

`strategy.generate_signals()` is called once on the full DataFrame before
the loop starts, but signals are consumed one bar late, so no future close
is ever used to make a trade decision.

---

## Adding a new strategy

1. Open `strategy.py`.
2. Subclass `Strategy` and implement `generate_signals`:

```python
class MyStrategy(Strategy):
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        # df has columns: open, high, low, close, volume
        # Return an integer Series aligned to df.index:
        #   1  = long
        #   0  = flat
        #  -1  = short
        signal = pd.Series(0, index=df.index, dtype=int)
        # ... your logic here, using only df["close"].rolling(...) etc. ...
        return signal
```

3. In `run.py`, replace the strategy line:

```python
from strategy import MyStrategy
strategy = MyStrategy(...)
```

**Rules to avoid look-ahead bias inside `generate_signals`:**
- Only use rolling/expanding operations on `df["close"]` (or other OHLCV columns).
- Never use `.shift(-n)` with a negative shift (that reads future bars).
- Never index `df.iloc[i+k]` for `k > 0`.

---

## Changing parameters

Everything is in `run.py`:

```python
TICKER          = "AAPL"
START           = "2015-01-01"
END             = "2024-01-01"
INITIAL_CAPITAL = 50_000.0
COMMISSION      = 0.0005    # 0.05 %
SLIPPAGE        = 0.0002    # 0.02 %

strategy = SmaCrossover(fast=20, slow=100)
```

---

## Transaction costs model

For each trade (entry or exit), the fill price is adjusted:

| Action | Effective fill price |
|--------|---------------------|
| Buy (long entry / short cover) | `open × (1 + commission + slippage)` |
| Sell (long exit / short entry) | `open × (1 − commission − slippage)` |

With defaults (0.10 % commission + 0.05 % slippage), a round-trip costs
approximately **0.30 %** of position value.

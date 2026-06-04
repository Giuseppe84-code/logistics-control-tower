"""
strategy.py — Base Strategy interface and concrete implementations.

To add a new strategy:
  1. Subclass Strategy.
  2. Implement generate_signals(df) → pd.Series.
  3. Return an integer Series aligned to df.index:
       1  = go / stay long
       0  = go / stay flat
      -1  = go / stay short
  4. Pass your instance to engine.run_backtest().

IMPORTANT: generate_signals() receives the FULL price DataFrame, but the
signal at index t must only use information available at the CLOSE of bar t
(i.e., df.iloc[:t+1]).  The engine enforces the execution lag (see engine.py),
but it cannot prevent you from accidentally reading future data inside this
function.  Stick to rolling indicators computed on the close series and you
will be fine.
"""

from abc import ABC, abstractmethod
import pandas as pd


class Strategy(ABC):
    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """
        Parameters
        ----------
        df : DataFrame with at least a 'close' column, DatetimeIndex.

        Returns
        -------
        pd.Series of int {-1, 0, 1} with the same index as df.
        signal[t] is produced from data available at close of bar t;
        the engine will execute it at the OPEN of bar t+1.
        """


class SmaCrossover(Strategy):
    """
    Golden-cross / death-cross strategy.

    Rules:
      fast_ma > slow_ma  →  signal = 1 (long)
      fast_ma ≤ slow_ma  →  signal = 0 (flat)

    Bars where the slow MA is not yet defined (first `slow` bars) get signal 0.
    """

    def __init__(self, fast: int = 50, slow: int = 200):
        if fast >= slow:
            raise ValueError(f"fast ({fast}) must be < slow ({slow})")
        self.fast = fast
        self.slow = slow

    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        close = df["close"]

        # Both MAs are computed only from past + current bar data
        # (rolling with default min_periods = window ensures no partial windows).
        fast_ma = close.rolling(self.fast).mean()
        slow_ma = close.rolling(self.slow).mean()

        # Where slow_ma is NaN (warm-up period), we stay flat.
        signal = pd.Series(0, index=df.index, dtype=int)
        signal[fast_ma > slow_ma] = 1
        # fast_ma <= slow_ma already maps to 0 (default).

        return signal

    def __repr__(self) -> str:
        return f"SmaCrossover(fast={self.fast}, slow={self.slow})"

"""
data.py — Fetch and cache OHLCV data via yfinance.

Parquet cache lives in .cache/ so repeated runs skip the network.
Cache key encodes ticker + date range, so changing any parameter
forces a fresh download.
"""

from pathlib import Path
import pandas as pd
import yfinance as yf

CACHE_DIR = Path(__file__).parent / ".cache"


def get_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Return a daily OHLCV DataFrame for `ticker` over [start, end).

    Columns (lowercase): open, high, low, close, volume
    Index: DatetimeIndex (UTC-naive)
    """
    CACHE_DIR.mkdir(exist_ok=True)
    cache_file = CACHE_DIR / f"{ticker}_{start}_{end}.parquet"

    if cache_file.exists():
        print(f"[data] Loading from cache: {cache_file.name}")
        return pd.read_parquet(cache_file)

    print(f"[data] Downloading {ticker} from {start} to {end} …")
    df = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)

    if df.empty:
        raise ValueError(f"No data returned for ticker '{ticker}' ({start} → {end})")

    # yfinance ≥ 0.2 returns MultiIndex columns for single tickers; flatten.
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.droplevel(1)

    df.columns = [c.lower() for c in df.columns]
    df.index = pd.to_datetime(df.index)
    df.sort_index(inplace=True)

    df.to_parquet(cache_file)
    print(f"[data] Cached to {cache_file.name} ({len(df)} rows)")
    return df

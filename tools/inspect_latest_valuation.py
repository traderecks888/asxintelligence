import pathlib
import pandas as pd
from datetime import datetime

val_dir = pathlib.Path('data/valuations')
files = sorted(val_dir.glob('ASX_Intrinsic_Valuations_*.xlsx'))
if not files:
    print('No valuation files found in', val_dir)
    raise SystemExit(1)
latest = files[-1]
print('Latest file:', latest)
xl = pd.ExcelFile(latest)
print('Sheets:', xl.sheet_names)
# read first sheet
df = xl.parse(xl.sheet_names[0])
print('\nColumns:')
for c in df.columns:
    print('-', c)
print('\nFirst 5 rows:')
print(df.head(5).to_string(index=False))
print('\nRow count:', len(df))

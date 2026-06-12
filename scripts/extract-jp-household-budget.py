#!/usr/bin/env python3
"""Extract a tidy yearly series from the Japan Family Income and Expenditure
Survey workbooks in public/jp-family-income-expenditure-survey.

For each survey year Y (2007-2024) the value for Y is taken from that year's
own annual-report file:
  - <Y>/sn0101.xls  Table 1-1, time series of disbursements, Total Households
  - <Y>/sn0102.xls  Table 1-2, receipts and disbursements, Workers' Households

Output: public/blog/jp-household-budget/jp-household-budget.json

Requires: pip install xlrd
"""

import json
import re
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "jp-family-income-expenditure-survey"
OUT_PATH = ROOT / "public" / "blog" / "jp-household-budget" / "jp-household-budget.json"

YEARS = range(2007, 2025)


def normalize_label(label: str) -> str:
    label = re.sub(r"\s+", " ", label).strip()
    label = label.replace(",", ", ").replace(",  ", ", ")
    return re.sub(r"\s+", " ", label)


def read_first_sheet_rows(path: Path):
    """Return (year_to_column, rows) where rows are (normalized_english_label, row_values)."""
    sheet = xlrd.open_workbook(path).sheets()[0]
    year_row = None
    year_cols = []
    for r in range(min(sheet.nrows, 20)):
        cols = [
            c
            for c in range(sheet.ncols)
            if isinstance(sheet.cell_value(r, c), float)
            and 1990 <= sheet.cell_value(r, c) <= 2030
        ]
        if len(cols) >= 3:
            year_row, year_cols = r, cols
            break
    if year_row is None:
        raise ValueError(f"no year header row found in {path}")

    year_to_col = {int(sheet.cell_value(year_row, c)): c for c in year_cols}
    last_year_col = year_cols[-1]
    rows = []
    for r in range(year_row + 1, sheet.nrows):
        english = " ".join(
            str(sheet.cell_value(r, c)).strip()
            for c in range(last_year_col + 1, sheet.ncols)
            if str(sheet.cell_value(r, c)).strip()
        )
        if english:
            rows.append((normalize_label(english), r))
    return sheet, year_to_col, rows


def extract_items(path: Path, year: int, wanted: dict[str, str]) -> dict[str, float]:
    """Return {output_key: value} for the first occurrence of each wanted label."""
    sheet, year_to_col, rows = read_first_sheet_rows(path)
    col = year_to_col[year]
    out = {}
    for label, r in rows:
        key = wanted.get(label)
        if key is not None and key not in out:
            value = sheet.cell_value(r, col)
            if isinstance(value, float):
                out[key] = value
    return out


CATEGORY_LABELS = {
    "Consumption expenditures": "total",
    "Food": "food",
    "Housing": "housing",
    "Fuel, light & water charges": "fuel",
    "Furniture & household utensils": "furniture",
    "Clothing & footwear": "clothing",
    "Medical care": "medical",
    "Transportation & communication": "transport",
    "Education": "education",
    "Culture & recreation": "recreation",
    "Other consumption expenditures": "other",
}

CONTEXT_LABELS = {
    "Engel's coefficient (%)": "engel",
    "Yearly income (in 10, 000 yen)": "yearlyIncome",
    "Num. of persons per household (persons)": "persons",
    "Age of household heads (years old)": "age",
}

ITEM_LABELS = {
    "Rice": "rice",
    "Bread": "bread",
    "Cooked food": "cookedFood",
    "Eating out": "eatingOut",
    "Fish & shellfish": "fish",
    "Meat": "meat",
    "Communication": "communication",
    "Electricity": "electricity",
    "Books & other reading materials": "books",
    "Package tours": "packageTours",
    "Tobacco": "tobacco",
    "Medical services": "medicalServices",
}

WORKERS_LABELS = {
    "Income": "income",
    "Disposable income": "disposableIncome",
    "Non-consumption expenditures": "nonConsumption",
    "Direct taxes": "directTaxes",
    "Social insurance premiums": "socialInsurance",
    "Consumption expenditures": "consumption",
    "Surplus": "surplus",
    "Yearly income (in 10, 000 yen)": "yearlyIncome",
}


def main() -> None:
    total_wanted = {
        normalize_label(k): v
        for k, v in {**CATEGORY_LABELS, **CONTEXT_LABELS, **ITEM_LABELS}.items()
    }
    workers_wanted = {normalize_label(k): v for k, v in WORKERS_LABELS.items()}

    total_rows = []
    workers_rows = []
    for year in YEARS:
        total = extract_items(DATA_DIR / str(year) / "sn0101.xls", year, total_wanted)
        workers = extract_items(DATA_DIR / str(year) / "sn0102.xls", year, workers_wanted)
        missing = (set(total_wanted.values()) - set(total)) | (
            set(workers_wanted.values()) - set(workers)
        )
        if missing:
            raise ValueError(f"{year}: missing {sorted(missing)}")
        total_rows.append({"year": year, **total})
        workers_rows.append({"year": year, **workers})

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(
            {
                "source": "Statistics Bureau of Japan, Family Income and Expenditure Survey, annual reports 2007-2024 (e-Stat)",
                "unit": "yen per month per household unless noted",
                "totalHouseholds": total_rows,
                "workersHouseholds": workers_rows,
            },
            indent=1,
        )
        + "\n"
    )
    print(f"wrote {OUT_PATH} ({len(total_rows)} years)")


if __name__ == "__main__":
    main()

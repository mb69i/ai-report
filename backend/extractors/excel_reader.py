"""
Atlas Backend – Excel Reader Utility

Reads Excel files (.xlsx) or CSV files (.csv) uploaded by the user,
extracting rows as a list of dicts. Used in loop-driven workflow runs.
"""

from pathlib import Path
from typing import List, Dict
import openpyxl
import csv


class ExcelReader:
    """Helper to parse Excel or CSV sheets into structured dictionaries."""

    @staticmethod
    def read_file(file_path: str) -> List[Dict]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Batch file '{file_path}' does not exist.")

        ext = path.suffix.lower()
        if ext == ".xlsx":
            return ExcelReader._read_xlsx(path)
        elif ext == ".csv":
            return ExcelReader._read_csv(path)
        else:
            raise ValueError(f"Unsupported file format: {ext}. Upload .xlsx or .csv")

    @staticmethod
    def _read_xlsx(path: Path) -> List[Dict]:
        wb = openpyxl.load_workbook(str(path), data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))

        if not rows:
            return []

        # Find header row (first row that has non-empty values)
        header = None
        header_idx = 0
        for i, r in enumerate(rows):
            if any(cell is not None for cell in r):
                header = [str(c).strip() if c is not None else f"Column_{j}" for j, c in enumerate(r)]
                header_idx = i
                break

        if not header:
            return []

        data_rows = []
        for r in rows[header_idx + 1:]:
            # Skip empty rows
            if not any(cell is not None for cell in r):
                continue
            row_dict = {}
            for j, val in enumerate(r):
                if j < len(header):
                    row_dict[header[j]] = val
            data_rows.append(row_dict)

        return data_rows

    @staticmethod
    def _read_csv(path: Path) -> List[Dict]:
        data_rows = []
        with open(path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                data_rows.append({k.strip(): v for k, v in row.items() if k is not None})
        return data_rows

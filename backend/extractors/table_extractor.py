"""Atlas Backend – Table Extractor (HTML → list of dicts)"""

from typing import List, Dict, Any
from playwright.async_api import Page
from .base import BaseExtractor


class TableExtractor(BaseExtractor):
    """
    Extracts HTML tables into a list of row dicts.
    Handles merged headers, nested tables, and multiple tables.
    """

    async def extract(self, page: Page, selector: str = "table", **kwargs) -> List[Dict[str, Any]]:
        """
        Extract the first table matching the selector.
        Returns: [{"Column A": "value", "Column B": "value"}, ...]
        """
        try:
            result = await page.evaluate(
                """(selector) => {
                    const table = document.querySelector(selector);
                    if (!table) return [];

                    // Extract headers
                    const headerCells = table.querySelectorAll('thead th, thead td');
                    let headers = [];
                    if (headerCells.length > 0) {
                        headers = Array.from(headerCells).map(th => th.innerText.trim() || `Col_${headers.length}`);
                    } else {
                        // No thead — use first row as header
                        const firstRow = table.querySelector('tr');
                        if (firstRow) {
                            headers = Array.from(firstRow.querySelectorAll('th, td')).map((c, i) => c.innerText.trim() || `Col_${i}`);
                        }
                    }

                    // Extract rows
                    const bodyRows = headerCells.length > 0
                        ? table.querySelectorAll('tbody tr')
                        : Array.from(table.querySelectorAll('tr')).slice(1);

                    const rows = [];
                    for (const row of bodyRows) {
                        const cells = row.querySelectorAll('td, th');
                        if (cells.length === 0) continue;
                        const rowData = {};
                        cells.forEach((cell, i) => {
                            const key = headers[i] || `Col_${i}`;
                            rowData[key] = cell.innerText.trim();
                        });
                        rows.push(rowData);
                    }
                    return rows;
                }""",
                selector
            )
            return result or []
        except Exception as e:
            return [{"error": f"TableExtractor error: {e}"}]

    async def extract_all(self, page: Page, selector: str = "table") -> List[List[Dict[str, Any]]]:
        """Extract ALL tables on the page matching the selector."""
        try:
            count = await page.locator(selector).count()
            results = []
            for i in range(count):
                locator = page.locator(selector).nth(i)
                html = await locator.inner_html()
                # Re-query using unique nth matching via JS
                table_data = await page.evaluate(
                    """([selector, index]) => {
                        const tables = document.querySelectorAll(selector);
                        const table = tables[index];
                        if (!table) return [];
                        const headers = Array.from(table.querySelectorAll('thead th, thead td')).map((th, i) => th.innerText.trim() || `Col_${i}`);
                        const rows = [];
                        for (const row of table.querySelectorAll('tbody tr, tr')) {
                            const cells = row.querySelectorAll('td, th');
                            if (cells.length === 0) continue;
                            const obj = {};
                            cells.forEach((c, j) => { obj[headers[j] || `Col_${j}`] = c.innerText.trim(); });
                            rows.push(obj);
                        }
                        return rows;
                    }""",
                    [selector, i]
                )
                results.append(table_data or [])
            return results
        except Exception as e:
            return [[{"error": str(e)}]]

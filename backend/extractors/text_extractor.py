"""Atlas Backend – Text Extractor"""

from playwright.async_api import Page
from .base import BaseExtractor


class TextExtractor(BaseExtractor):
    """Extracts plain text content from a page element."""

    async def extract(self, page: Page, selector: str = "body", **kwargs) -> str:
        try:
            element = await page.query_selector(selector)
            if element:
                return (await element.inner_text()).strip()
            return ""
        except Exception as e:
            return f"[TextExtractor error: {e}]"

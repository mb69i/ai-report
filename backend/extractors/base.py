"""Atlas Backend – Extraction Engine: Base Interface"""

from abc import ABC, abstractmethod
from typing import Any
from playwright.async_api import Page


class BaseExtractor(ABC):
    """
    All extractors implement this interface.
    Returns structured JSON-serializable data.
    """

    @abstractmethod
    async def extract(self, page: Page, selector: str = None, **kwargs) -> Any:
        """Extract data from the page. Returns JSON-serializable result."""
        ...

    def name(self) -> str:
        return self.__class__.__name__

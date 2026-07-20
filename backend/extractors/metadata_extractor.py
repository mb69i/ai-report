"""Atlas Backend – Metadata Extractor"""

from typing import Dict, Any
from playwright.async_api import Page
from .base import BaseExtractor


class MetadataExtractor(BaseExtractor):
    """Extracts page metadata: title, URL, meta tags, Open Graph, etc."""

    async def extract(self, page: Page, selector: str = None, **kwargs) -> Dict[str, Any]:
        try:
            return await page.evaluate("""() => {
                const getMeta = (name) => {
                    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                    return el ? el.getAttribute('content') : null;
                };
                return {
                    title: document.title,
                    url: window.location.href,
                    description: getMeta('description'),
                    keywords: getMeta('keywords'),
                    og_title: getMeta('og:title'),
                    og_description: getMeta('og:description'),
                    og_image: getMeta('og:image'),
                    charset: document.characterSet,
                    lang: document.documentElement.lang,
                    last_modified: document.lastModified,
                    links_count: document.querySelectorAll('a').length,
                    images_count: document.querySelectorAll('img').length,
                    tables_count: document.querySelectorAll('table').length,
                };
            }""")
        except Exception as e:
            return {"error": str(e)}

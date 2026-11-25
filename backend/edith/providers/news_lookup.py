"""
Lightweight Live News & Current Events Context Fetcher for EDITH.
Uses Google News RSS feeds via httpx so Online LLMs receive up-to-date headlines.
"""

from __future__ import annotations
import re
import urllib.parse
import xml.etree.ElementTree as ET
from typing import List
import httpx
from loguru import logger


def needs_live_news(prompt: str) -> bool:
    low = prompt.lower()
    triggers = (
        "news",
        "headline",
        "what happened",
        "what's happening",
        "whats happening",
        "latest",
        "current events",
        "breaking",
        "today in",
        "trending",
        "update on",
    )
    return any(t in low for t in triggers)


async def fetch_news_context(prompt: str, max_items: int = 6) -> str:
    """Fetches top recent headlines from Google News RSS for online LLM grounding."""
    try:
        # Extract topic query if specific, else top headlines
        cleaned = re.sub(
            r"\b(tell me|what is|what's|whats|the|latest|news|headlines|happened|about|on|in|today|please)\b",
            " ",
            prompt.lower(),
        )
        topic = " ".join(cleaned.split()).strip()
        if len(topic) >= 3:
            q = urllib.parse.quote_plus(topic)
            url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
        else:
            url = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"

        async with httpx.AsyncClient(timeout=4.5, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return ""

        root = ET.fromstring(resp.text)
        items = root.findall(".//item")[:max_items]
        lines: List[str] = []
        for it in items:
            title = (it.findtext("title") or "").strip()
            pub = (it.findtext("pubDate") or "").strip()
            if title:
                lines.append(f"- {title}" + (f" ({pub})" if pub else ""))

        if not lines:
            return ""
        return "\n\n### Live Current News Headlines:\n" + "\n".join(lines)
    except Exception as e:
        logger.debug(f"Live news RSS lookup skipped: {e}")
        return ""

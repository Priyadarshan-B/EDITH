"""
Live News & Headlines Retrieval Tool for EDITH.
Retrieves top breaking news, national/regional headlines, and category digests
via Google News RSS and lightweight HTML feeds (zero API keys required).
"""

from __future__ import annotations
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import asyncio
from typing import Dict, Any, Type, Optional, List
from pydantic import BaseModel, Field

from edith.tools.base import BaseTool, ToolExecutionResult
from edith.security.permissions import ActionRiskTier


class LiveNewsInput(BaseModel):
    topic_or_location: Optional[str] = Field(
        "India",
        description="Topic, location, or country to get news for (e.g. 'India', 'World', 'Technology', 'AI', 'Business')."
    )
    max_items: int = Field(5, description="Maximum number of top headlines to fetch (1-10).")


class LiveNewsTool(BaseTool):
    """Retrieve top live news headlines and summaries."""

    name = "get_live_news"
    description = (
        "Get current top news headlines and breaking stories for a country or topic (e.g., 'Tdy news in india', 'Tech news')."
    )
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema: Type[BaseModel] = LiveNewsInput

    async def execute(self, topic_or_location: str = "India", max_items: int = 5) -> ToolExecutionResult:
        max_items = min(max(1, max_items), 10)

        def _fetch_rss() -> List[Dict[str, str]]:
            query = topic_or_location.strip()
            # Google News RSS search
            encoded = urllib.parse.quote(query)
            rss_url = f"https://news.google.com/rss/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"
            
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) EDITH/2.0"}
            req = urllib.request.Request(rss_url, headers=headers)
            
            items = []
            try:
                with urllib.request.urlopen(req, timeout=6) as resp:
                    xml_content = resp.read()
                    root = ET.fromstring(xml_content)
                    
                    for item in root.findall(".//item"):
                        if len(items) >= max_items:
                            break
                        title = item.findtext("title", "")
                        link = item.findtext("link", "")
                        pub_date = item.findtext("pubDate", "")
                        source = item.findtext("source", "")
                        if title:
                            items.append({
                                "title": title,
                                "source": source,
                                "published": pub_date[:16] if pub_date else "",
                                "link": link
                            })
            except Exception:
                pass
            return items

        try:
            loop = asyncio.get_running_loop()
            news_items = await loop.run_in_executor(None, _fetch_rss)

            if not news_items:
                return ToolExecutionResult(
                    success=True,
                    data={"topic": topic_or_location, "headlines": []},
                    message=f"No current news articles found for '{topic_or_location}'.",
                    verified=True
                )

            summary_lines = [f"Boss, here are the top headlines for {topic_or_location}:"]
            for idx, item in enumerate(news_items, 1):
                src = f" ({item['source']})" if item.get("source") else ""
                summary_lines.append(f"{idx}. {item['title']}{src}")

            full_msg = "\n".join(summary_lines)

            return ToolExecutionResult(
                success=True,
                data={"topic": topic_or_location, "headlines": news_items, "count": len(news_items)},
                message=full_msg,
                verified=True
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data={"topic": topic_or_location, "error": str(e)},
                message=f"Failed to fetch live news: {str(e)}",
                verified=False
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success

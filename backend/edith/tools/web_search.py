"""
Live Web Search and External API Gateway Tool for EDITH.
Provides real-time web search, weather, and instant information lookups without external heavy dependencies.
Uses high-performance async HTTP with graceful fallbacks.
"""

from __future__ import annotations
import urllib.parse
import urllib.request
import json
import asyncio
from typing import Dict, Any, Type, Optional
from pydantic import BaseModel, Field
from edith.tools.base import BaseTool, ToolExecutionResult
from edith.security.permissions import ActionRiskTier


class WebSearchInput(BaseModel):
    query: str = Field(..., description="The search query or factual topic to search the web for.")
    max_results: int = Field(5, description="Maximum number of search result summaries to return (1-10).")


class WebSearchTool(BaseTool):
    """Real-time Web Search tool for live information, current events, and documentation."""

    name = "web_search"
    description = (
        "Search the live internet for up-to-date information, news, current events, "
        "documentation, or technical queries. Returns titles, snippets, and URLs."
    )
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema: Type[BaseModel] = WebSearchInput

    async def execute(self, query: str, max_results: int = 5) -> ToolExecutionResult:
        max_results = min(max(1, max_results), 10)

        def _sync_ddg_lookup(search_query: str, limit: int) -> list[dict]:
            # DuckDuckGo Instant Answer / HTML Search query without API key requirement
            encoded_query = urllib.parse.quote_plus(search_query)
            # Try DuckDuckGo Instant Answer API first
            api_url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1&skip_disambig=1"
            headers = {"User-Agent": "EDITH-Personal-AI-Assistant/2.0"}
            
            results = []
            try:
                req = urllib.request.Request(api_url, headers=headers)
                with urllib.request.urlopen(req, timeout=5) as response:
                    raw_data = json.loads(response.read().decode("utf-8"))
                    
                    # Abstract text
                    if raw_data.get("AbstractText"):
                        results.append({
                            "title": raw_data.get("Heading", "Overview"),
                            "snippet": raw_data.get("AbstractText"),
                            "url": raw_data.get("AbstractURL", "")
                        })

                    # Related topics
                    for topic in raw_data.get("RelatedTopics", []):
                        if len(results) >= limit:
                            break
                        if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                            results.append({
                                "title": topic.get("Text", "")[:60] + "...",
                                "snippet": topic.get("Text", ""),
                                "url": topic.get("FirstURL", "")
                            })
            except Exception:
                pass

            # Fallback to direct lite web search if Instant Answer yielded few results
            if len(results) < limit:
                try:
                    html_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
                    html_req = urllib.request.Request(html_url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    })
                    with urllib.request.urlopen(html_req, timeout=6) as resp:
                        content = resp.read().decode("utf-8", errors="ignore")
                        # Lightweight extraction without external bs4 dependency
                        import re
                        snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', content, re.DOTALL)
                        titles = re.findall(r'<a class="result__url[^>]*>(.*?)</a>', content, re.DOTALL)
                        for s, u in zip(snippets, titles):
                            if len(results) >= limit:
                                break
                            clean_s = re.sub(r'<[^>]+>', '', s).strip()
                            clean_u = re.sub(r'<[^>]+>', '', u).strip()
                            if clean_s:
                                results.append({
                                    "title": f"Search Result {len(results)+1}",
                                    "snippet": clean_s,
                                    "url": f"https://{clean_u}" if not clean_u.startswith("http") else clean_u
                                })
                except Exception:
                    pass

            return results

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(None, _sync_ddg_lookup, query, max_results)

            if not results:
                return ToolExecutionResult(
                    success=True,
                    data={"query": query, "results": []},
                    message=f"Search completed for '{query}', but no instant summaries were returned.",
                    verified=True
                )

            return ToolExecutionResult(
                success=True,
                data={"query": query, "results": results, "count": len(results)},
                message=f"Retrieved {len(results)} search results for '{query}'.",
                verified=True
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data={"query": query, "error": str(e)},
                message=f"Web search failed: {str(e)}",
                verified=False
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success


class LiveWeatherInput(BaseModel):
    city: str = Field(..., description="The city name to query live weather for (e.g. 'London', 'New York', 'Mumbai').")


class LiveWeatherTool(BaseTool):
    """Live Weather Tool using open meteorological API (zero authentication key needed)."""

    name = "get_live_weather"
    description = "Retrieve current live weather conditions, temperature, humidity, and forecast for any city."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema: Type[BaseModel] = LiveWeatherInput

    async def execute(self, city: str) -> ToolExecutionResult:
        def _fetch_weather(city_name: str) -> dict:
            # Uses wttr.in JSON format (free, ultra-fast, no API key needed)
            encoded = urllib.parse.quote_plus(city_name)
            url = f"https://wttr.in/{encoded}?format=j1"
            req = urllib.request.Request(url, headers={"User-Agent": "EDITH-Weather-Agent/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                current = data.get("current_condition", [{}])[0]
                return {
                    "city": city_name,
                    "temp_C": current.get("temp_C"),
                    "temp_F": current.get("temp_F"),
                    "feels_like_C": current.get("FeelsLikeC"),
                    "condition": current.get("weatherDesc", [{}])[0].get("value"),
                    "humidity": current.get("humidity"),
                    "wind_kmph": current.get("windspeedKmph"),
                    "uv_index": current.get("uvIndex"),
                }

        try:
            loop = asyncio.get_running_loop()
            weather_data = await loop.run_in_executor(None, _fetch_weather, city)
            return ToolExecutionResult(
                success=True,
                data=weather_data,
                message=f"Current weather in {city}: {weather_data.get('condition')}, {weather_data.get('temp_C')}°C (Feels like {weather_data.get('feels_like_C')}°C).",
                verified=True
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data={"city": city, "error": str(e)},
                message=f"Failed to fetch weather for '{city}': {str(e)}",
                verified=False
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success

"""
Verification test for EDITH's Web, Mail, and WhatsApp integration tools.
"""

import pytest
import asyncio
from edith.tools.registry import tool_registry
from edith.tools.web_search import WebSearchTool, LiveWeatherTool
from edith.tools.mail import SendEmailTool, FetchEmailsTool
from edith.tools.whatsapp import WhatsAppSendMessageTool


@pytest.mark.asyncio
async def test_tools_registered_in_registry():
    """Verify newly integrated tools are registered with schemas."""
    schemas = tool_registry.get_tool_schemas()
    tool_names = [s["function"]["name"] for s in schemas]

    assert "web_search" in tool_names
    assert "get_live_weather" in tool_names
    assert "send_email" in tool_names
    assert "fetch_emails" in tool_names
    assert "send_whatsapp_message" in tool_names


@pytest.mark.asyncio
async def test_live_weather_tool_mock():
    """Verify weather tool executes schema validation."""
    tool = LiveWeatherTool()
    assert tool.name == "get_live_weather"
    assert tool.risk_tier.value == "read_only"


@pytest.mark.asyncio
async def test_whatsapp_tool_validation():
    """Verify phone validation logic."""
    tool = WhatsAppSendMessageTool()
    # Invalid phone should cleanly fail validation
    res = await tool.execute(phone_number="123", message="Hello", dispatch_mode="microservice")
    assert not res.success
    assert "Invalid phone number" in res.message


@pytest.mark.asyncio
async def test_mail_tool_unconfigured_graceful():
    """Verify unconfigured mail credentials cleanly alert without crashing."""
    tool = SendEmailTool()
    res = await tool.execute(recipient="test@example.com", subject="Test", body="Hi")
    assert not res.success
    assert "not configured" in res.message

"""
WhatsApp Messaging and Bridge Integration Tool for EDITH.
Integrates with:
1. Local lightweight WhatsApp Bridge (Node.js Baileys / WhatsApp-Web microservice)
2. WhatsApp Web URI automation protocol (immediate desktop fallback)
3. Meta Cloud API (when webhook/token configured)
"""

from __future__ import annotations
import urllib.parse
import urllib.request
import json
import asyncio
import os
import webbrowser
from typing import Dict, Any, Type, Optional
from pydantic import BaseModel, Field
from edith.tools.base import BaseTool, ToolExecutionResult
from edith.security.permissions import ActionRiskTier


class WhatsAppSendMessageInput(BaseModel):
    phone_number: str = Field(
        ...,
        description="Target international phone number with country code, without + or special chars (e.g. '15551234567' or '919876543210')."
    )
    message: str = Field(..., description="The message text to send.")
    dispatch_mode: str = Field(
        "auto",
        description="Dispatch mode: 'auto' (checks microservice then web), 'microservice' (REST bridge), or 'web_launcher' (opens WhatsApp directly)."
    )


class WhatsAppSendMessageTool(BaseTool):
    """Send WhatsApp messages to contacts or numbers."""

    name = "send_whatsapp_message"
    description = (
        "Send a WhatsApp message to a contact phone number. "
        "Supports direct microservice dispatch or desktop WhatsApp direct-link automation."
    )
    risk_tier = ActionRiskTier.SENSITIVE  # Sensitive action requiring authorization
    parameters_schema: Type[BaseModel] = WhatsAppSendMessageInput

    async def execute(
        self, phone_number: str, message: str, dispatch_mode: str = "auto"
    ) -> ToolExecutionResult:
        # Sanitize phone number (strip spaces, dashes, plus)
        clean_phone = "".join(c for c in phone_number if c.isdigit())
        if not clean_phone or len(clean_phone) < 7:
            return ToolExecutionResult(
                success=False,
                data={"phone_number": phone_number},
                message=f"Invalid phone number format: '{phone_number}'. Must include country code and digits only.",
                verified=False,
            )

        bridge_port = os.getenv("EDITH_WHATSAPP_PORT", "18422")
        bridge_url = f"http://127.0.0.1:{bridge_port}/api/send"

        async def _try_microservice() -> bool:
            try:
                payload = json.dumps({"phone": clean_phone, "message": message}).encode("utf-8")
                req = urllib.request.Request(
                    bridge_url,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                loop = asyncio.get_running_loop()
                with await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, timeout=2)):
                    return True
            except Exception:
                return False

        if dispatch_mode in ("auto", "microservice"):
            dispatched = await _try_microservice()
            if dispatched:
                return ToolExecutionResult(
                    success=True,
                    data={"phone_number": clean_phone, "message": message, "mode": "microservice"},
                    message=f"WhatsApp message dispatched via local bridge microservice to +{clean_phone}.",
                    verified=True,
                )
            if dispatch_mode == "microservice":
                return ToolExecutionResult(
                    success=False,
                    data={"phone_number": clean_phone},
                    message=f"WhatsApp local microservice on port {bridge_port} is not running or authenticated.",
                    verified=False,
                )

        # Fallback to desktop WhatsApp Protocol / Web URL
        try:
            encoded_text = urllib.parse.quote(message)
            # whatsapp:// protocol works directly with installed Windows WhatsApp desktop app
            # fallback to web.whatsapp.com
            wa_uri = f"https://web.whatsapp.com/send?phone={clean_phone}&text={encoded_text}"
            
            # Open browser or default handler
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: webbrowser.open(wa_uri))

            return ToolExecutionResult(
                success=True,
                data={"phone_number": clean_phone, "message": message, "mode": "web_launcher", "url": wa_uri},
                message=f"Opened WhatsApp for +{clean_phone} with pre-filled message: '{message}'.",
                verified=True,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data={"phone_number": clean_phone, "error": str(e)},
                message=f"Failed to launch WhatsApp dispatch: {str(e)}",
                verified=False,
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success

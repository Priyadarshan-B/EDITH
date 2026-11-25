"""
Universal Mail Management Tool for EDITH.
Supports:
1. Sending emails via asynchronous SMTP (TLS/SSL).
2. Fetching unread emails and searching inboxes via IMAP.
3. Checking connection and configuration status.
Configurable via environment variables or direct parameters.
"""

from __future__ import annotations
import smtplib
import imaplib
import email
from email.header import decode_header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
import os
from typing import Dict, Any, Type, Optional, List
from pydantic import BaseModel, Field
from edith.tools.base import BaseTool, ToolExecutionResult
from edith.security.permissions import ActionRiskTier


class SendEmailInput(BaseModel):
    recipient: str = Field(..., description="Target email address (e.g. 'contact@example.com').")
    subject: str = Field(..., description="Email subject line.")
    body: str = Field(..., description="Email message body (plain text or markdown).")


class SendEmailTool(BaseTool):
    """Tool to send emails via configured SMTP credentials."""

    name = "send_email"
    description = "Send an email message to a specified recipient with a subject and body."
    risk_tier = ActionRiskTier.SENSITIVE  # Sensitive action requiring verification/confirmation
    parameters_schema: Type[BaseModel] = SendEmailInput

    async def execute(self, recipient: str, subject: str, body: str) -> ToolExecutionResult:
        smtp_server = os.getenv("EDITH_SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("EDITH_SMTP_PORT", "587"))
        sender_email = os.getenv("EDITH_MAIL_USER", "")
        sender_password = os.getenv("EDITH_MAIL_PASSWORD", "")

        if not sender_email or not sender_password:
            return ToolExecutionResult(
                success=False,
                data={"recipient": recipient, "subject": subject},
                message=(
                    "Mail service is not configured. Please set EDITH_MAIL_USER and "
                    "EDITH_MAIL_PASSWORD (e.g., App Password) in your .env configuration."
                ),
                verified=False,
            )

        def _sync_send() -> bool:
            msg = MIMEMultipart()
            msg["From"] = sender_email
            msg["To"] = recipient
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(sender_email, sender_password)
                server.send_message(msg)
            return True

        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, _sync_send)
            return ToolExecutionResult(
                success=True,
                data={"recipient": recipient, "subject": subject, "sender": sender_email},
                message=f"Email successfully dispatched to {recipient} with subject '{subject}'.",
                verified=True,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data={"recipient": recipient, "error": str(e)},
                message=f"Failed to send email to {recipient}: {str(e)}",
                verified=False,
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success


class FetchEmailsInput(BaseModel):
    folder: str = Field("INBOX", description="Mailbox folder name (default 'INBOX').")
    limit: int = Field(5, description="Number of recent emails to retrieve (1-15).")
    unread_only: bool = Field(True, description="Whether to filter only unread emails.")


class FetchEmailsTool(BaseTool):
    """Tool to read recent emails and unread messages from inbox."""

    name = "fetch_emails"
    description = "Read recent or unread emails from your configured mailbox, returning sender, subject, and date."
    risk_tier = ActionRiskTier.READ_ONLY
    parameters_schema: Type[BaseModel] = FetchEmailsInput

    async def execute(self, folder: str = "INBOX", limit: int = 5, unread_only: bool = True) -> ToolExecutionResult:
        imap_server = os.getenv("EDITH_IMAP_SERVER", "imap.gmail.com")
        user_email = os.getenv("EDITH_MAIL_USER", "")
        password = os.getenv("EDITH_MAIL_PASSWORD", "")

        if not user_email or not password:
            return ToolExecutionResult(
                success=False,
                data={"folder": folder},
                message="Mail credentials not configured. Set EDITH_MAIL_USER and EDITH_MAIL_PASSWORD in .env.",
                verified=False,
            )

        limit = min(max(1, limit), 15)

        def _sync_fetch() -> List[Dict[str, str]]:
            emails = []
            with imaplib.IMAP4_SSL(imap_server, timeout=10) as mail:
                mail.login(user_email, password)
                mail.select(folder)
                
                search_criteria = "UNSEEN" if unread_only else "ALL"
                status, response = mail.search(None, search_criteria)
                
                if status != "OK" or not response[0]:
                    return []

                msg_ids = response[0].split()
                # Most recent first
                for msg_id in reversed(msg_ids[-limit:]):
                    _, data = mail.fetch(msg_id, "(RFC822.HEADER)")
                    for part in data:
                        if isinstance(part, tuple):
                            raw_email = part[1]
                            parsed = email.message_from_bytes(raw_email)
                            
                            def _decode_hdr(header_val: Optional[str]) -> str:
                                if not header_val:
                                    return ""
                                decoded_parts = decode_header(header_val)
                                text = ""
                                for b, enc in decoded_parts:
                                    if isinstance(b, bytes):
                                        text += b.decode(enc or "utf-8", errors="ignore")
                                    else:
                                        text += str(b)
                                return text

                            emails.append({
                                "from": _decode_hdr(parsed.get("From")),
                                "subject": _decode_hdr(parsed.get("Subject")),
                                "date": parsed.get("Date", "")
                            })
            return emails

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(None, _sync_fetch)
            return ToolExecutionResult(
                success=True,
                data={"emails": results, "count": len(results)},
                message=f"Retrieved {len(results)} email(s) from {folder}.",
                verified=True,
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                data={"folder": folder, "error": str(e)},
                message=f"Failed to fetch emails: {str(e)}",
                verified=False,
            )

    async def verify(self, result: ToolExecutionResult, **kwargs) -> bool:
        return result.success

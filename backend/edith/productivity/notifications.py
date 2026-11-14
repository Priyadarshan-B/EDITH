"""
Windows OS Native Desktop Toast Notification Dispatcher for EDITH.
Sends interactive notifications to Windows Action Center using WinRT/PowerShell bridge.
"""

from __future__ import annotations
import asyncio
import sys
import subprocess
from loguru import logger


class WindowsToastNotifier:
    @staticmethod
    async def send_toast(title: str, message: str, app_id: str = "EDITH Assistant") -> bool:
        """
        Dispatches a native Windows Action Center Toast Notification.
        Falls back to console/loguru logging in headless environments or on non-Windows platforms.
        """
        if sys.platform != "win32":
            logger.info(f"[OS Notification] {title}: {message}")
            return True

        ps_script = f"""
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = @"
<toast duration="short">
    <visual>
        <binding template="ToastGeneric">
            <text>{title}</text>
            <text>{message}</text>
        </binding>
    </visual>
</toast>
"@
        try {{
            $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
            $xml.LoadXml($template)
            $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
            [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("{app_id}").Show($toast)
        }} catch {{
            # Suppress if running in headless session without notification manager
        }}
        """

        try:
            # Run PowerShell script asynchronously
            process = await asyncio.create_subprocess_exec(
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                ps_script,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            # Short timeout to avoid blocking
            try:
                await asyncio.wait_for(process.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                process.kill()

            logger.info(f"Dispatched Windows Toast Notification: '{title}' - '{message}'")
            return True
        except Exception as e:
            logger.warning(f"Could not dispatch Windows Toast Notification: {e}")
            return False


toast_notifier = WindowsToastNotifier()

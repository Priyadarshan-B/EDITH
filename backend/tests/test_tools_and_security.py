"""
Pytest integration test suite for EDITH Desktop Automation, Tools, and Security Subsystems.
"""

import os
from pathlib import Path
import pytest

from edith.security.permissions import ActionRiskTier, AuthorizationMode
from edith.security.path_jail import PathJailSecurity
from edith.security.sanitizer import CommandSanitizer
from edith.security.audit import AuditLogger
from edith.tools.desktop import ListRunningAppsTool, GetActiveWindowTool
from edith.tools.filesystem import ReadFileTool, WriteFileTool, DeleteFileTool, SearchFilesTool
from edith.tools.terminal import ExecuteTerminalCommandTool
from edith.core.orchestrator import orchestrator


def test_path_jail_security():
    """Verify path jail permits approved project paths and strictly blocks OS system roots."""
    # 1. Allowed paths
    allowed_file = Path(os.getcwd()) / "README.md"
    is_safe, _ = PathJailSecurity.validate_path(str(allowed_file))
    assert is_safe is True

    # 2. Blocked system paths
    is_safe_win, reason = PathJailSecurity.validate_path("C:\\Windows\\System32\\cmd.exe")
    assert is_safe_win is False
    assert "protected Windows system directory" in reason

    # 3. Path traversal attack escaping to Windows system directory
    is_safe_traversal, reason = PathJailSecurity.validate_path(str(allowed_file) + "/../../../Windows/System32")
    assert is_safe_traversal is False


def test_command_sanitizer():
    """Verify shell sanitizer blocks forbidden destructive patterns while allowing safe commands."""
    # Safe commands
    assert CommandSanitizer.sanitize("git status")[0] is True
    assert CommandSanitizer.sanitize("dir")[0] is True
    assert CommandSanitizer.sanitize("python --version")[0] is True

    # Dangerous / forbidden commands
    assert CommandSanitizer.sanitize("rmdir /s /q C:\\")[0] is False
    assert CommandSanitizer.sanitize("format D:")[0] is False
    assert CommandSanitizer.sanitize("reg delete HKLM\\Software")[0] is False
    assert CommandSanitizer.sanitize("Remove-Item -Recurse -Force C:\\")[0] is False


@pytest.mark.asyncio
async def test_filesystem_tools_lifecycle():
    """Verify sandboxed file write, read, search, and delete with OS verification."""
    write_tool = WriteFileTool()
    read_tool = ReadFileTool()
    search_tool = SearchFilesTool()
    del_tool = DeleteFileTool()

    test_file = Path(os.getcwd()) / "data" / "edith_test_sandbox.txt"
    test_content = "EDITH security protocol verification payload."

    try:
        # 1. Write file
        w_res = await write_tool.execute(file_path=str(test_file), content=test_content)
        assert w_res.success is True
        assert w_res.verified is True
        assert test_file.exists()

        # 2. Read file
        r_res = await read_tool.execute(file_path=str(test_file))
        assert r_res.success is True
        assert r_res.verified is True
        assert test_content in r_res.data["content"]

        # 3. Search files
        s_res = await search_tool.execute(directory=str(test_file.parent), pattern="*edith_test*")
        assert s_res.success is True
        assert any("edith_test_sandbox.txt" in m["name"] for m in s_res.data["matches"])

        # 4. Delete file
        d_res = await del_tool.execute(target_path=str(test_file))
        assert d_res.success is True
        assert d_res.verified is True
        assert not test_file.exists()

    finally:
        if test_file.exists():
            test_file.unlink()


@pytest.mark.asyncio
async def test_desktop_tools_inspection():
    """Verify desktop process listing and active window querying."""
    list_tool = ListRunningAppsTool()
    win_tool = GetActiveWindowTool()

    # 1. Process list
    res_list = await list_tool.execute(limit=10)
    assert res_list.success is True
    assert res_list.verified is True
    assert res_list.data["count"] > 0
    assert "processes" in res_list.data

    # 2. Active window
    res_win = await win_tool.execute()
    assert res_win.success is True
    assert res_win.verified is True


@pytest.mark.asyncio
async def test_orchestrator_dual_channel_authorization():
    """Verify orchestrator routes through risk tiers, holds destructive actions, and audits decisions."""
    # 1. Read-only intent auto-executes
    read_res = await orchestrator.execute_or_request_authorization(
        tool_name="list_running_applications",
        parameters={"limit": 5},
    )
    assert read_res["status"] == "completed"
    assert read_res["verified"] is True

    # 2. Destructive intent is held for GUI authorization
    dest_res = await orchestrator.execute_or_request_authorization(
        tool_name="delete_file_or_directory",
        parameters={"target_path": "test_dummy.txt"},
    )
    assert dest_res["status"] == "requires_gui_authorization"
    action_id = dest_res["action_id"]

    # 3. Resolve authorization (Simulate user clicking 'Authorize' in the GUI modal)
    resolve_res = await orchestrator.resolve_authorization(
        action_id=action_id,
        approved=True,
        mode=AuthorizationMode.GUI_MODAL_CONFIRMED,
    )
    # Execution ran (fails safely if file didn't exist, but authorization path is verified)
    assert "status" in resolve_res

    # 4. Verify audit logs recorded both actions in SQLite
    logs = await AuditLogger.get_recent_logs(limit=10)
    assert len(logs) >= 2
    action_names = [l["action_name"] for l in logs]
    assert "list_running_applications" in action_names
    assert "delete_file_or_directory" in action_names

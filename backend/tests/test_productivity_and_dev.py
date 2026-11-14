"""
Unit & Integration Tests for EDITH Personal Productivity and Developer Assistance Engines.
"""

from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient, ASGITransport

from edith.server import create_app
from edith.tools.developer import GitStatusTool, DirectoryTreeTool
from edith.productivity.scheduler import edith_scheduler


@pytest.mark.asyncio
async def test_developer_git_status_tool():
    """Validates Git repository inspection tool."""
    tool = GitStatusTool()
    result = await tool.execute(repo_path=".")

    assert result.success is True
    assert "branch" in result.data
    assert "changed_files_count" in result.data
    assert isinstance(result.data["recent_commits"], list)


@pytest.mark.asyncio
async def test_developer_directory_tree_tool():
    """Validates project directory tree generator tool."""
    tool = DirectoryTreeTool()
    result = await tool.execute(root_dir="backend/edith/productivity", max_depth=2)

    assert result.success is True
    assert result.data["type"] == "directory"
    child_names = [c["name"] for c in result.data["children"]]
    assert "scheduler.py" in child_names
    assert "notifications.py" in child_names


@pytest.mark.asyncio
async def test_productivity_tasks_api_lifecycle():
    """Tests CRUD lifecycle of tasks via REST API."""
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Task
        resp = await client.post(
            "/api/v1/productivity/tasks",
            json={
                "title": "Build Iron Man Mark 86 armor",
                "description": "Composite vibranium nanotech alloy",
                "priority": "urgent",
            },
        )
        assert resp.status_code == 200
        task_data = resp.json()
        assert task_data["title"] == "Build Iron Man Mark 86 armor"
        task_id = task_data["id"]

        # 2. List Tasks
        list_resp = await client.get("/api/v1/productivity/tasks")
        assert list_resp.status_code == 200
        tasks = list_resp.json()
        assert any(t["id"] == task_id for t in tasks)

        # 3. Update Task Status
        patch_resp = await client.patch(
            f"/api/v1/productivity/tasks/{task_id}",
            json={"status": "completed"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["status"] == "completed"

        # 4. Delete Task
        del_resp = await client.delete(f"/api/v1/productivity/tasks/{task_id}")
        assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_productivity_reminders_and_scheduler():
    """Tests reminder scheduling and daily summary generation."""
    app = create_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a reminder for 10 minutes in the future
        future_time = datetime.now(timezone.utc) + timedelta(minutes=10)
        resp = await client.post(
            "/api/v1/productivity/reminders",
            json={
                "message": "Review arc reactor telemetry",
                "trigger_at": future_time.isoformat(),
            },
        )
        assert resp.status_code == 200
        rem_data = resp.json()
        rem_id = rem_data["id"]

        # Check Daily Briefing
        summary_resp = await client.get("/api/v1/productivity/daily-summary")
        assert summary_resp.status_code == 200
        summary_data = summary_resp.json()
        assert "spoken_summary" in summary_data
        assert isinstance(summary_data["upcoming_reminders"], list)

        # Cleanup reminder
        del_resp = await client.delete(f"/api/v1/productivity/reminders/{rem_id}")
        assert del_resp.status_code == 200

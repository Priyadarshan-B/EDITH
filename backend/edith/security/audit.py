"""
Security Audit Logger for EDITH.
Maintains an immutable record of all tool calls and authorization decisions in SQLite.
"""

from __future__ import annotations
import json
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy import select, desc
from loguru import logger

from edith.memory.database import AsyncSessionLocal
from edith.memory.models import SecurityAuditLog
from edith.security.permissions import ActionRiskTier, AuthorizationMode


class AuditLogger:
    @staticmethod
    async def log_action(
        action_name: str,
        risk_tier: ActionRiskTier | str,
        authorization_mode: AuthorizationMode | str,
        parameters: Dict[str, Any],
        status: str,  # 'success', 'failed', 'rejected', 'aborted'
    ) -> str:
        """Records an action execution attempt into SQLite audit logs."""
        try:
            tier_val = risk_tier.value if hasattr(risk_tier, "value") else str(risk_tier)
            auth_val = authorization_mode.value if hasattr(authorization_mode, "value") else str(authorization_mode)

            async with AsyncSessionLocal() as session:
                log_entry = SecurityAuditLog(
                    action_name=action_name,
                    risk_tier=tier_val,
                    authorization_mode=auth_val,
                    parameters_json=json.dumps(parameters, default=str),
                    status=status,
                    executed_at=datetime.utcnow(),
                )
                session.add(log_entry)
                await session.commit()
                return log_entry.id
        except Exception as e:
            logger.error(f"Failed to record security audit log: {e}")
            return ""

    @staticmethod
    async def get_recent_logs(limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves chronological security audit entries for the HUD timeline."""
        try:
            async with AsyncSessionLocal() as session:
                query = (
                    select(SecurityAuditLog)
                    .order_by(desc(SecurityAuditLog.executed_at))
                    .limit(limit)
                )
                result = await session.execute(query)
                logs = result.scalars().all()
                return [
                    {
                        "id": log.id,
                        "action_name": log.action_name,
                        "risk_tier": log.risk_tier,
                        "authorization_mode": log.authorization_mode,
                        "parameters": json.loads(log.parameters_json or "{}"),
                        "status": log.status,
                        "executed_at": log.executed_at.isoformat(),
                    }
                    for log in logs
                ]
        except Exception as e:
            logger.error(f"Failed to query audit logs: {e}")
            return []

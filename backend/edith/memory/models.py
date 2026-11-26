"""
SQLAlchemy 2.0 ORM Models for EDITH Relational Storage.
"""

from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship

from edith.memory.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system', 'tool'
    content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    tokens_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
    )


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="pending", nullable=False)  # pending, in_progress, completed, cancelled
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high, critical
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    reminders = relationship("Reminder", back_populates="task", cascade="all, delete-orphan")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    message = Column(Text, nullable=False)
    trigger_at = Column(DateTime, nullable=False)
    recurrence_rule = Column(String(100), nullable=True)  # cron string or interval
    is_acknowledged = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    task = relationship("Task", back_populates="reminders")


class UserFact(Base):
    __tablename__ = "user_facts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    category = Column(String(50), nullable=False)  # preference, environment, personal, project
    fact_content = Column(Text, nullable=False)
    confidence_score = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_verified = Column(DateTime, default=datetime.utcnow, nullable=False)


class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    action_name = Column(String(100), nullable=False)
    risk_tier = Column(String(50), nullable=False)
    authorization_mode = Column(String(50), nullable=False)  # auto, voice_confirmed, gui_modal_confirmed, denied
    parameters_json = Column(Text, nullable=True)
    status = Column(String(30), nullable=False)  # success, failed, rejected
    executed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    level = Column(String(20), nullable=False)       # INFO, WARNING, ERROR, CRITICAL, DEBUG
    category = Column(String(40), nullable=False)    # api, llm, system, error, voice, mcp
    source = Column(String(120), nullable=False)     # module:line or endpoint
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_system_logs_level_created", "level", "created_at"),
    )



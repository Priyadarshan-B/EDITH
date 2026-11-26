"""
Autonomous Continuous Learning & Model Personalization Engine for EDITH.
Extracts high-quality interactions, compiles instruction datasets, and manages local model personalization.
"""

from __future__ import annotations
import os
import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from loguru import logger
from sqlalchemy import select, desc

from edith.memory.database import AsyncSessionLocal
from edith.memory.models import Message, Conversation, UserFact


class ContinuousLearner:
    def __init__(self, data_dir: str = "data/training"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.dataset_file = self.data_dir / "personal_dataset.jsonl"
        self.status_file = self.data_dir / "training_status.json"
        self.logs_file = self.data_dir / "human_logs.json"
        self.patterns_file = self.data_dir / "command_patterns.json"

        # Load persisted status
        self.enabled = True
        self.is_training = False
        self.total_pairs = 0
        self.last_trained_at: Optional[str] = None
        self._load_state()

    def _load_state(self):
        try:
            if self.status_file.exists():
                with open(self.status_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.enabled = data.get("enabled", True)
                    self.total_pairs = data.get("total_pairs", 0)
                    self.last_trained_at = data.get("last_trained_at")
        except Exception as e:
            logger.warning(f"Could not load continuous learning state: {e}")

    def _save_state(self):
        try:
            data = {
                "enabled": self.enabled,
                "total_pairs": self.total_pairs,
                "last_trained_at": self.last_trained_at,
                "is_training": self.is_training,
                "updated_at": datetime.utcnow().isoformat(),
            }
            with open(self.status_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Could not save continuous learning state: {e}")

    def append_human_log(self, title: str, details: str, category: str = "learned"):
        """Logs a friendly human-readable milestone in the learner timeline."""
        logs = self.get_human_logs()
        new_entry = {
            "id": f"log_{int(time.time()*1000)}",
            "title": title,
            "details": details,
            "category": category,  # learned, synced, system, optimized
            "timestamp": datetime.now().strftime("%Y-%m-%d %I:%M %p"),
        }
        logs.insert(0, new_entry)
        # Retain last 50 entries
        logs = logs[:50]
        try:
            with open(self.logs_file, "w", encoding="utf-8") as f:
                json.dump(logs, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save human logs: {e}")

    def get_command_patterns(self) -> List[Dict[str, Any]]:
        """Returns learned command & knowledge patterns fused from offline and online LLMs."""
        if not self.patterns_file.exists():
            return []
        try:
            with open(self.patterns_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def get_pattern_stats(self) -> Dict[str, int]:
        patterns = self.get_command_patterns()
        return {
            "total_patterns": len(patterns),
            "offline_count": sum(1 for p in patterns if p.get("source_mode") == "offline_local"),
            "online_count": sum(1 for p in patterns if p.get("source_mode") == "online_cloud"),
            "tool_count": sum(1 for p in patterns if p.get("source_mode") == "desktop_tool"),
        }

    async def record_interaction_pattern(
        self,
        prompt: str,
        response: str,
        source_mode: str,
        model_used: str,
        intent_or_tool: Optional[str] = None,
    ):
        """
        Records every command/query and fuses knowledge from both offline local LLMs
        and online cloud LLMs into EDITH's local training dataset + vector memory.
        """
        if not self.enabled or not prompt.strip() or not response.strip():
            return
        if response.startswith(("[Error", "[Streaming Error", "[Gemini Request Failed")):
            return

        clean_summary = " ".join(response.strip().split())[:220]
        entry = {
            "id": f"pat_{int(time.time() * 1000)}",
            "prompt": prompt.strip()[:220],
            "intent_or_tool": intent_or_tool or ("world_knowledge" if source_mode == "online_cloud" else "assistant_chat"),
            "source_mode": source_mode,  # offline_local, online_cloud, desktop_tool
            "model_used": model_used,
            "learned_summary": clean_summary,
            "confidence": 0.95 if source_mode == "desktop_tool" else 0.9,
            "timestamp": datetime.now().strftime("%Y-%m-%d %I:%M:%S %p"),
        }

        patterns = self.get_command_patterns()
        patterns.insert(0, entry)
        patterns = patterns[:120]
        try:
            with open(self.patterns_file, "w", encoding="utf-8") as f:
                json.dump(patterns, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save command patterns: {e}")

        # Append pair to JSONL fine-tuning dataset for local Ollama personalization
        try:
            pair = {
                "instruction": prompt.strip(),
                "input": "",
                "output": response.strip(),
                "source": source_mode,
                "model": model_used,
            }
            with open(self.dataset_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(pair) + "\n")
            self.total_pairs += 1
            self._save_state()
        except Exception as e:
            logger.warning(f"Failed to append training JSONL pair: {e}")

        # Log concise human-readable milestone for online/offline knowledge fusion
        if source_mode == "online_cloud":
            self.append_human_log(
                title=f"Distilled Online Knowledge ({model_used})",
                details=f"Learned from query '{prompt[:60]}...' to enrich future offline responses.",
                category="synced",
            )
        elif source_mode == "desktop_tool":
            self.append_human_log(
                title=f"Learned Command Pattern ({intent_or_tool})",
                details=f"Captured command '{prompt[:60]}' for faster local intent routing.",
                category="learned",
            )

        # Index high-value online/offline factual answers into ChromaDB vector store
        if source_mode in ("online_cloud", "offline_local") and len(response.strip()) > 30:
            try:
                from edith.memory.vector_store import vector_store
                await vector_store.add_fact(
                    fact_id=entry["id"],
                    content=f"Q: {prompt.strip()[:160]} -> A: {clean_summary}",
                    category=f"learned_{source_mode}",
                    confidence=0.85,
                )
            except Exception:
                pass

    def get_human_logs(self) -> List[Dict[str, Any]]:
        """Returns human-readable learning history."""
        if not self.logs_file.exists():
            # Seed initial friendly logs
            initial = [
                {
                    "id": "log_init_1",
                    "title": "Continuous Learning Engine Initialized",
                    "details": "EDITH is actively observing your workflow, preferred apps, and commands to personalize local offline intelligence.",
                    "category": "system",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %I:%M %p"),
                },
                {
                    "id": "log_init_2",
                    "title": "Operator Preferences Synchronized",
                    "details": "Operator address protocol locked to 'Boss' / 'Sir' with natural female vocalization profile.",
                    "category": "learned",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %I:%M %p"),
                }
            ]
            try:
                with open(self.logs_file, "w", encoding="utf-8") as f:
                    json.dump(initial, f, indent=2)
            except Exception:
                pass
            return initial

        try:
            with open(self.logs_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def set_enabled(self, enabled: bool) -> bool:
        """Toggles continuous learning on/off."""
        self.enabled = enabled
        self._save_state()
        state_str = "ENABLED" if enabled else "PAUSED"
        self.append_human_log(
            title=f"Personalization Engine {state_str.title()}",
            details=f"Automatic background dataset compilation and habit training is now {state_str.lower()}.",
            category="system",
        )
        return self.enabled

    async def compile_training_dataset(self) -> int:
        """
        Extracts high-quality interactions and user facts from SQLite
        and compiles them into a clean fine-tuning dataset.
        """
        if not self.enabled:
            logger.info("Continuous learning is disabled. Skipping compilation.")
            return self.total_pairs

        dataset_entries = []

        async with AsyncSessionLocal() as session:
            # 1. Export user preferences & facts
            fact_stmt = select(UserFact).order_by(desc(UserFact.confidence_score))
            fact_res = await session.execute(fact_stmt)
            facts = fact_res.scalars().all()

            for f in facts:
                dataset_entries.append({
                    "instruction": f"What is the user's preference or detail regarding {f.category}?",
                    "input": "",
                    "output": f"The operator prefers: {f.content}.",
                    "source": "fact_store",
                })

            # 2. Export verified conversation pairs
            # Fetch user messages followed by non-error assistant responses
            msg_stmt = (
                select(Message)
                .order_by(Message.conversation_id, Message.created_at)
                .limit(500)
            )
            msg_res = await session.execute(msg_stmt)
            all_msgs = msg_res.scalars().all()

            # Pair sequential user -> assistant
            i = 0
            while i < len(all_msgs) - 1:
                current_msg = all_msgs[i]
                next_msg = all_msgs[i + 1]

                if (
                    current_msg.role == "user"
                    and next_msg.role == "assistant"
                    and current_msg.conversation_id == next_msg.conversation_id
                ):
                    user_text = current_msg.content.strip()
                    asst_text = next_msg.content.strip()

                    # Filter out error messages
                    if (
                        user_text
                        and asst_text
                        and not asst_text.startswith(("[Error", "[Streaming Error", "[Gemini Request Failed"))
                    ):
                        dataset_entries.append({
                            "instruction": user_text,
                            "input": "",
                            "output": asst_text,
                            "source": "chat_history",
                        })
                    i += 2
                else:
                    i += 1

        # Write clean JSONL dataset
        with open(self.dataset_file, "w", encoding="utf-8") as f:
            for item in dataset_entries:
                f.write(json.dumps(item) + "\n")

        self.total_pairs = len(dataset_entries)
        self._save_state()
        return self.total_pairs

    async def run_personalization_cycle(self) -> Dict[str, Any]:
        """
        Executes a complete personalization cycle:
        1. Compiles clean training data from daily usage.
        2. Generates an updated Modelfile for Ollama with personal system directives.
        3. Records human-readable summary.
        """
        self.is_training = True
        self._save_state()
        try:
            pairs_count = await self.compile_training_dataset()

            # Generate personalized Modelfile for local Ollama using active/configured local model
            from edith.config import settings
            from edith.providers.manager import model_manager

            base_local_model = (
                model_manager.active_model_name
                if model_manager.active_provider_type == "ollama" and model_manager.active_model_name
                else settings.models.local.routing_model
            )
            op_name = settings.user.name or "Priyan"
            op_title = settings.user.title or "Boss"

            modelfile_path = self.data_dir / "Modelfile.edith"
            modelfile_content = (
                "# Personalized EDITH Local Model Definition\n"
                f"FROM {base_local_model}\n\n"
                "# Hyperparameters tailored for snappy desktop assistant\n"
                "PARAMETER temperature 0.6\n"
                "PARAMETER top_p 0.9\n"
                "PARAMETER num_ctx 4096\n\n"
                "# Personalized Operator Directives\n"
                "SYSTEM \"\"\"\n"
                "You are EDITH (Even Dead, I'm The Hero), a warm, friendly, witty human-like personal AI assistant.\n"
                "OPERATOR RULES:\n"
                f"- Naturally address the operator as '{op_title}', 'Sir', or '{op_name}' depending on the moment.\n"
                "- Sound conversational, warm, and genuinely human—never robotic or stiff.\n"
                "- Keep action responses short, clear, and easy to understand.\n"
                "- You are running locally and tailored to the operator's Windows 11 desktop workflow.\n"
                "\"\"\"\n"
            )
            with open(modelfile_path, "w", encoding="utf-8") as f:
                f.write(modelfile_content)

            self.last_trained_at = datetime.now().strftime("%Y-%m-%d %I:%M %p")
            self.is_training = False
            self._save_state()

            # Human-readable progress log
            summary = (
                f"Compiled {pairs_count} interaction pairs and verified habits into your personal dataset. "
                f"Personalized offline model definition updated at '{modelfile_path}'."
            )
            self.append_human_log(
                title=f"Personalization Cycle Completed ({pairs_count} Pairs)",
                details=summary,
                category="optimized",
            )

            return {
                "status": "success",
                "total_pairs": pairs_count,
                "dataset_file": str(self.dataset_file),
                "modelfile": str(modelfile_path),
                "last_trained_at": self.last_trained_at,
            }

        except Exception as e:
            self.is_training = False
            self._save_state()
            logger.error(f"Error during personalization cycle: {e}")
            self.append_human_log(
                title="Personalization Notice",
                details=f"Dataset compilation encountered a minor notice: {str(e)}",
                category="system",
            )
            return {"status": "error", "message": str(e)}


# Global Singleton
continuous_learner = ContinuousLearner()


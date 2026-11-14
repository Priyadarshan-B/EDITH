import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Clock,
  GitBranch,
  FolderTree,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  RefreshCw,
  Calendar,
  Terminal,
} from "lucide-react";
import {
  api,
  TaskItem,
  ReminderItem,
  DailyBriefingItem,
} from "../../api/client";
import { wsClient } from "../../api/ws";
import { useSystemStore } from "../../stores/systemStore";

export const ProductivityTab: React.FC = () => {
  const { operatorName } = useSystemStore();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefingItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Task Filter
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "completed">("all");

  // New Task Form
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  // New Reminder Form Modal
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState(15);

  // Developer Tooling States
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [dirTree, setDirTree] = useState<any>(null);
  const [devLoading, setDevLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [taskList, reminderList, brief] = await Promise.all([
        api.getTasks(),
        api.getReminders(),
        api.getDailyBriefing(),
      ]);
      setTasks(taskList);
      setReminders(reminderList);
      setBriefing(brief);
    } catch (e) {
      console.error("Failed to load productivity data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen for real-time REMINDER_TRIGGERED from WebSocket
    const unsub = wsClient.on("REMINDER_TRIGGERED", (payload) => {
      fetchData();
      if (payload?.message) {
        // Visual notification
        console.log("HUD Notification:", payload.message);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const created = await api.createTask(newTitle, undefined, newPriority);
      setTasks((prev) => [created, ...prev]);
      setNewTitle("");
      // Refresh briefing stats
      api.getDailyBriefing().then(setBriefing);
    } catch (e) {
      console.error("Failed to create task:", e);
    }
  };

  const handleToggleTaskStatus = async (task: TaskItem) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const updated = await api.updateTask(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      api.getDailyBriefing().then(setBriefing);
    } catch (e) {
      console.error("Failed to toggle task:", e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      api.getDailyBriefing().then(setBriefing);
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderMsg.trim()) return;
    try {
      const triggerTime = new Date(Date.now() + reminderMinutes * 60000).toISOString();
      const created = await api.createReminder(reminderMsg, triggerTime);
      setReminders((prev) => [...prev, created]);
      setReminderMsg("");
      setIsReminderModalOpen(false);
      api.getDailyBriefing().then(setBriefing);
    } catch (e) {
      console.error("Failed to create reminder:", e);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await api.deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      api.getDailyBriefing().then(setBriefing);
    } catch (e) {
      console.error("Failed to delete reminder:", e);
    }
  };

  const handleInspectGit = async () => {
    setDevLoading(true);
    try {
      const res = await api.inspectGitStatus();
      if (res?.result?.data) {
        setGitStatus(res.result.data);
      }
    } catch (e) {
      console.error("Git inspection failed:", e);
    } finally {
      setDevLoading(false);
    }
  };

  const handleInspectTree = async () => {
    setDevLoading(true);
    try {
      const res = await api.inspectDirectoryTree(2);
      if (res?.result?.data) {
        setDirTree(res.result.data);
      }
    } catch (e) {
      console.error("Tree inspection failed:", e);
    } finally {
      setDevLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "all") return true;
    if (taskFilter === "pending") return t.status !== "completed";
    return t.status === "completed";
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "urgent":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "high":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "medium":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      default:
        return "bg-slate-700/40 text-slate-300 border-slate-600/40";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f18]/80 backdrop-blur-md overflow-hidden text-slate-200">
      {/* HUD Header */}
      <div className="p-4 border-b border-cyan-500/20 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <CheckSquare className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold tracking-wider text-cyan-400 uppercase font-mono">
                Productivity & Developer Assistant
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                APScheduler + WinRT
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Task Kanban, background notifications, and developer telemetry
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 transition-colors"
          title="Refresh Productivity Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. Daily Stark Briefing Card */}
        {briefing && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Calendar className="w-24 h-24 text-cyan-400" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-semibold tracking-widest text-cyan-400 uppercase">
                    DAILY BRIEFING FOR {operatorName}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                </div>
                <p className="text-sm text-slate-200 font-sans italic">
                  &quot;{briefing.spoken_summary}&quot;
                </p>
              </div>

              {/* Stat Counters */}
              <div className="flex items-center space-x-3">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-lg font-bold font-mono text-cyan-400">{briefing.pending_tasks}</div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Pending</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-lg font-bold font-mono text-emerald-400">{briefing.completed_tasks}</div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Completed</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                  <div className="text-lg font-bold font-mono text-amber-400">{briefing.upcoming_reminders.length}</div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Reminders</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Tasks & Reminders Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Task Board (2 Columns) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-semibold text-slate-200 uppercase">
                    Active Tasks & To-Do
                  </span>
                </div>
                {/* Filter Tabs */}
                <div className="flex items-center space-x-1">
                  {(["all", "pending", "completed"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTaskFilter(f)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize transition-all ${
                        taskFilter === f
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Add Task Input */}
              <form onSubmit={handleCreateTask} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Add new task or action item..."
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {/* Task Items List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-mono">
                    No tasks found in this view.
                  </div>
                ) : (
                  filteredTasks.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                        <button
                          onClick={() => handleToggleTaskStatus(t)}
                          className="text-slate-400 hover:text-cyan-400 transition-colors flex-shrink-0"
                        >
                          {t.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                        <span
                          className={`text-xs truncate font-sans ${
                            t.status === "completed"
                              ? "line-through text-slate-500"
                              : "text-slate-200"
                          }`}
                        >
                          {t.title}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase border ${getPriorityBadge(
                            t.priority
                          )}`}
                        >
                          {t.priority}
                        </span>
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Scheduled Reminders (1 Column) */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-semibold text-slate-200 uppercase">
                    Reminders
                  </span>
                </div>
                <button
                  onClick={() => setIsReminderModalOpen(true)}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-mono transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Set</span>
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {reminders.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-mono">
                    No active reminders queued.
                  </div>
                ) : (
                  reminders.map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/30 transition-all space-y-1"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs text-slate-200 font-medium font-sans">
                          {r.message}
                        </p>
                        <button
                          onClick={() => handleDeleteReminder(r.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-amber-400/90 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(r.trigger_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Developer Assistance & Diagnostics Panel */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-semibold text-slate-200 uppercase">
                Developer Tooling & Repository Intelligence
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleInspectGit}
                disabled={devLoading}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-cyan-300 text-xs font-mono transition-all flex items-center space-x-1.5"
              >
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                <span>Inspect Git Status</span>
              </button>
              <button
                onClick={handleInspectTree}
                disabled={devLoading}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-cyan-300 text-xs font-mono transition-all flex items-center space-x-1.5"
              >
                <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inspect Directory Tree</span>
              </button>
            </div>
          </div>

          {/* Developer Output Console */}
          {gitStatus && (
            <div className="p-3 rounded-lg bg-slate-950 border border-cyan-500/20 font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between text-cyan-400 pb-1 border-b border-slate-800">
                <span className="font-semibold">Git Working Tree: {gitStatus.branch}</span>
                <span className={gitStatus.clean ? "text-emerald-400" : "text-amber-400"}>
                  {gitStatus.clean ? "Clean Working Copy" : `${gitStatus.changed_files_count} Changes Pending`}
                </span>
              </div>
              {gitStatus.recent_commits && (
                <div className="text-slate-400 text-[11px] pt-1">
                  <div className="text-slate-500 font-semibold mb-1">Recent Commits:</div>
                  {gitStatus.recent_commits.map((c: string, idx: number) => (
                    <div key={idx} className="text-slate-300">
                      • {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {dirTree && (
            <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/20 font-mono text-xs space-y-1.5">
              <div className="text-emerald-400 font-semibold pb-1 border-b border-slate-800">
                Project Directory Structure: /{dirTree.name}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 text-slate-300 text-[11px]">
                {dirTree.children?.map((child: any, idx: number) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className={child.type === "directory" ? "text-cyan-400" : "text-slate-400"}>
                      {child.type === "directory" ? "📁" : "📄"}
                    </span>
                    <span>{child.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Reminder Modal */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-950 border border-amber-500/40 rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.15)] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-amber-400 font-mono text-sm font-semibold">
                <Clock className="w-4 h-4" />
                <span>Schedule Reminder</span>
              </div>
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReminder} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Reminder Message
                </label>
                <input
                  type="text"
                  value={reminderMsg}
                  onChange={(e) => setReminderMsg(e.target.value)}
                  placeholder="e.g. Check server deployment logs"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-sans focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Trigger In
                </label>
                <select
                  value={reminderMinutes}
                  onChange={(e) => setReminderMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReminderModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-mono border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reminderMsg.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 text-xs font-mono transition-all shadow-[0_0_10px_rgba(245,158,11,0.15)] disabled:opacity-50"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

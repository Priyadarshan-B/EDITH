import React, { useEffect, useState } from "react";
import {
  FolderGit2,
  FolderPlus,
  FolderOpen,
  Rocket,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { api, AntigravityBuildJob, WorkspaceInfo } from "../../api/client";

export const WorkspacesTab: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceInfo | null>(null);
  const [projectsRoot, setProjectsRoot] = useState("");
  const [edithRoot, setEdithRoot] = useState("");
  const [targetSavePath, setTargetSavePath] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newTemplate, setNewTemplate] = useState<"empty" | "python" | "web">("python");
  const [buildPrompt, setBuildPrompt] = useState("");
  const [builds, setBuilds] = useState<AntigravityBuildJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wsRes, buildsRes] = await Promise.all([
        api.getWorkspaces(),
        api.getAntigravityBuilds(),
      ]);
      setWorkspaces(wsRes.workspaces);
      setActiveWorkspace(wsRes.active_workspace);
      setProjectsRoot(wsRes.projects_root);
      if (wsRes.edith_root) setEdithRoot(wsRes.edith_root);
      if (wsRes.active_workspace && !wsRes.active_workspace.is_edith_root && !targetSavePath) {
        setTargetSavePath(wsRes.active_workspace.path);
      }
      setBuilds(buildsRes.builds);
    } catch (e: any) {
      setStatusMsg(e.message || "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const timer = setInterval(() => {
      api.getAntigravityBuilds().then((r) => setBuilds(r.builds)).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleSelect = async (path: string) => {
    try {
      const res = await api.selectWorkspace(path);
      setActiveWorkspace(res.active_workspace);
      setTargetSavePath(res.active_workspace.path);
      setStatusMsg(`Active workspace switched to ${res.active_workspace.name}`);
      await loadAll();
    } catch (e: any) {
      setStatusMsg(e.message);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const res = await api.browseWorkspaceFolder();
      if (res.selected) {
        setTargetSavePath(res.selected);
        setActiveWorkspace(res.active_workspace);
        setStatusMsg(`Selected project folder: ${res.selected}`);
        await loadAll();
      }
    } catch (e: any) {
      setStatusMsg(e.message || "Folder browse failed");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const res = await api.createWorkspace(newProjectName.trim(), newTemplate);
      setActiveWorkspace(res.active_workspace);
      setTargetSavePath(res.active_workspace.path);
      setNewProjectName("");
      setStatusMsg(`Created workspace ${res.active_workspace.name}`);
      await loadAll();
    } catch (e: any) {
      setStatusMsg(e.message);
    }
  };

  const handleOpenEditor = async (editor: "antigravity" | "vscode", path?: string) => {
    try {
      const res = await api.openWorkspaceInEditor(path || targetSavePath || undefined, editor);
      setStatusMsg(`Opened ${res.path} in ${res.editor}`);
    } catch (e: any) {
      setStatusMsg(e.message);
    }
  };

  const handleBuildWithAntigravity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildPrompt.trim()) return;

    const chosenPath = targetSavePath.trim();
    if (!chosenPath) {
      setStatusMsg("Please enter or browse where to save the project first (e.g. c:\\Projects\\my-app).");
      return;
    }
    if (edithRoot && chosenPath.toLowerCase() === edithRoot.toLowerCase()) {
      setStatusMsg("Cannot build inside EDITH's own folder. Choose a separate folder path.");
      return;
    }

    setBuilding(true);
    try {
      const job = await api.startAntigravityBuild(buildPrompt.trim(), chosenPath);
      setBuildPrompt("");
      setStatusMsg(`Project build started (${job.build_id}) -> ${job.workspace_path}`);
      const buildsRes = await api.getAntigravityBuilds();
      setBuilds(buildsRes.builds);
    } catch (e: any) {
      setStatusMsg(e.message);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full p-4 md:p-6 select-none overflow-y-auto scrollbar-thin space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-hudCyan/10 border border-hudCyan flex items-center justify-center text-hudCyan shadow-hud">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-slate-100">
              Workspaces &amp; Project Builder
            </h2>
            <p className="text-xs text-slate-400">
              Root: <span className="font-mono text-slate-300">{projectsRoot || "c:\\Projects"}</span>
              {" | "}Active:{" "}
              <span className="font-mono text-hudCyan">
                {activeWorkspace ? activeWorkspace.name : "Ask / Choose Save Folder"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEditor("antigravity")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-hudCyan/50 bg-hudCyan/10 hover:bg-hudCyan/20 text-xs font-mono text-hudCyan transition-all cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Antigravity</span>
          </button>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-slate-800 text-xs font-mono text-slate-300 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2 rounded-xl border border-hudCyan/30 bg-hudCyan/5 text-xs font-mono text-hudCyan">
          {statusMsg}
        </div>
      )}

      {/* Project Builder (Antigravity SDK + Local/Cloud Fallback) */}
      <form
        onSubmit={handleBuildWithAntigravity}
        className="p-5 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md space-y-3"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-200">
            <Rocket className="w-4 h-4 text-hudCyan" />
            <span>Build Project (Antigravity SDK / Local &amp; Cloud LLM)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Works even without Antigravity API key (uses Ollama / Groq / Gemini)
          </span>
        </div>

        {/* Save Folder Picker */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={targetSavePath}
            onChange={(e) => setTargetSavePath(e.target.value)}
            placeholder="Where to save project? (e.g. c:\Projects\my-app or Desktop\my-app)"
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950/70 border border-border/80 text-xs font-mono text-hudCyan placeholder-slate-500 focus:outline-none focus:border-hudCyan"
          />
          <button
            type="button"
            onClick={handleBrowseFolder}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-hudCyan" />
            <span>Browse Folder...</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={buildPrompt}
            onChange={(e) => setBuildPrompt(e.target.value)}
            placeholder="Describe what you want to build (e.g. 'Build a Python FastAPI todo app')..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-border/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-hudCyan"
          />
          <button
            type="submit"
            disabled={building || !buildPrompt.trim()}
            className="px-5 py-2.5 rounded-xl bg-hudCyan text-slate-950 font-mono text-xs font-bold hover:bg-cyan-300 disabled:opacity-50 transition-all cursor-pointer"
          >
            {building ? "Starting..." : "Build Project"}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspaces List + Create */}
        <div className="p-5 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
            Project Workspaces
          </h3>

          <form onSubmit={handleCreate} className="flex flex-wrap sm:flex-nowrap gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="New project name or full path..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950/70 border border-border/80 text-xs font-mono text-slate-100 focus:outline-none focus:border-hudCyan"
            />
            <select
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-slate-950/70 border border-border/80 text-xs font-mono text-slate-200"
            >
              <option value="empty">Empty</option>
              <option value="python">Python</option>
              <option value="web">Web</option>
            </select>
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-hudCyan/50 bg-hudCyan/10 hover:bg-hudCyan/20 text-xs font-mono text-hudCyan cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </form>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
            {workspaces.map((ws) => (
              <div
                key={ws.path}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  ws.is_active
                    ? "border-hudCyan bg-hudCyan/10"
                    : "border-border/70 bg-slate-900/50 hover:border-slate-600"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-100 truncate">
                      {ws.name}
                    </span>
                    {ws.is_edith_root && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                        EDITH app
                      </span>
                    )}
                    {ws.is_git && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                        git
                      </span>
                    )}
                    {ws.is_active && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-hudCyan/20 text-hudCyan">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">{ws.path}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!ws.is_active && !ws.is_edith_root && (
                    <button
                      onClick={() => handleSelect(ws.path)}
                      className="px-2.5 py-1 rounded-lg border border-border bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200 cursor-pointer"
                    >
                      Use Folder
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEditor("vscode", ws.path)}
                    className="px-2 py-1 rounded-lg border border-border/70 text-[11px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Open in VS Code"
                  >
                    Code
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project Build Stream */}
        <div className="p-5 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
            Project Build Stream
          </h3>

          {builds.length === 0 ? (
            <div className="text-xs font-mono text-slate-500 py-8 text-center">
              No builds yet. Choose a save folder above or tell EDITH &quot;build ... in c:\Projects\...&quot;.
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {builds.map((job) => (
                <div
                  key={job.build_id}
                  className="p-3 rounded-xl border border-border/80 bg-slate-950/60 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-hudCyan">
                        {job.build_id}
                      </span>
                      {job.engine && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {job.engine}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-mono">
                      {job.status === "running" && (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span className="text-amber-300">RUNNING</span>
                        </>
                      )}
                      {job.status === "completed" && (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">COMPLETED</span>
                        </>
                      )}
                      {job.status === "failed" && (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-rose-300">FAILED</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200">{job.prompt}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {job.workspace_path}
                  </div>
                  {job.output_text && (
                    <div className="text-[11px] font-mono text-emerald-300/90 whitespace-pre-wrap">
                      {job.output_text}
                    </div>
                  )}
                  {job.events.length > 0 && (
                    <div className="text-[11px] font-mono text-slate-400 bg-black/40 rounded-lg p-2 max-h-24 overflow-y-auto">
                      {job.events.slice(-4).map((ev, i) => (
                        <div key={i} className="truncate">
                          [{ev.type}] {ev.content}
                        </div>
                      ))}
                    </div>
                  )}
                  {job.error && (
                    <div className="text-[11px] font-mono text-rose-400">{job.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

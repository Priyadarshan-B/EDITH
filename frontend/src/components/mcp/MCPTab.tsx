import React, { useEffect, useState } from "react";
import {
  Plug,
  RefreshCw,
  Plus,
  Play,
  Key,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Power,
  Loader2,
  Wrench,
  X,
  Code2,
  User,
} from "lucide-react";
import { api, MCPServerInfo, MCPToolSchema } from "../../api/client";

export const MCPTab: React.FC = () => {
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [filter, setFilter] = useState<"all" | "personal" | "developer">("all");
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Add Custom Server state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("npx");
  const [newArgs, setNewArgs] = useState("-y ");
  const [newCategory, setNewCategory] = useState<"developer" | "personal" | "productivity">("developer");
  const [newDescription, setNewDescription] = useState("");
  const [newEnvText, setNewEnvText] = useState("");
  const [addingServer, setAddingServer] = useState(false);

  // Env Editor state per server
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({});
  const [savingEnv, setSavingEnv] = useState(false);

  // Interactive Tool Runner modal state
  const [activeTool, setActiveTool] = useState<{ server: MCPServerInfo; tool: MCPToolSchema } | null>(null);
  const [toolArgsJson, setToolArgsJson] = useState("{}");
  const [toolFormArgs, setToolFormArgs] = useState<Record<string, string>>({});
  const [runningTool, setRunningTool] = useState(false);
  const [toolResult, setToolResult] = useState<{ is_error: boolean; output: string } | null>(null);

  const loadServers = async () => {
    setLoading(true);
    try {
      const res = await api.getMCPServers();
      setServers(res.servers || []);
    } catch (e: any) {
      setBanner({ type: "err", text: e.message || "Failed to load MCP servers" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleToggle = async (srv: MCPServerInfo) => {
    setTogglingId(srv.id);
    setBanner(null);
    try {
      const updated = await api.toggleMCPServer(srv.id, !srv.enabled);
      setServers((prev) => prev.map((item) => (item.id === srv.id ? updated : item)));
      setBanner({
        type: updated.status === "error" ? "err" : "ok",
        text: updated.enabled
          ? updated.status === "connected"
            ? `${updated.name} connected (${updated.tools.length} tools ready).`
            : `${updated.name} enabled (${updated.error || updated.status}).`
          : `${updated.name} disabled.`,
      });
    } catch (e: any) {
      setBanner({ type: "err", text: e.message || "Toggle failed" });
    } finally {
      setTogglingId(null);
    }
  };

  const openEnvEditor = (srv: MCPServerInfo) => {
    if (editingEnvId === srv.id) {
      setEditingEnvId(null);
      return;
    }
    const init: Record<string, string> = {};
    (srv.env_keys || []).forEach((k) => {
      init[k] = "";
    });
    setEnvDraft(init);
    setEditingEnvId(srv.id);
  };

  const handleSaveEnv = async (serverId: string) => {
    setSavingEnv(true);
    setBanner(null);
    try {
      const cleaned: Record<string, string> = {};
      Object.entries(envDraft).forEach(([k, v]) => {
        if (k.trim() && v.trim()) cleaned[k.trim()] = v.trim();
      });
      const updated = await api.updateMCPEnv(serverId, cleaned);
      setServers((prev) => prev.map((s) => (s.id === serverId ? updated : s)));
      setEditingEnvId(null);
      setBanner({ type: "ok", text: `Updated environment credentials for ${updated.name}.` });
    } catch (e: any) {
      setBanner({ type: "err", text: e.message || "Failed to update environment variables" });
    } finally {
      setSavingEnv(false);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newName.trim() || !newCommand.trim()) return;
    setAddingServer(true);
    setBanner(null);
    try {
      const envObj: Record<string, string> = {};
      newEnvText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes("="))
        .forEach((line) => {
          const idx = line.indexOf("=");
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k) envObj[k] = v;
        });

      const argsList = newArgs
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const added = await api.addCustomMCPServer({
        id: newId.trim().toLowerCase().replace(/\s+/g, "-"),
        name: newName.trim(),
        command: newCommand.trim(),
        args: argsList,
        category: newCategory,
        description: newDescription.trim(),
        env: envObj,
      });
      setServers((prev) => [...prev.filter((s) => s.id !== added.id), added]);
      setShowAddForm(false);
      setNewId("");
      setNewName("");
      setNewDescription("");
      setNewEnvText("");
      setBanner({ type: "ok", text: `Custom MCP server '${added.name}' added (${added.status}).` });
    } catch (e: any) {
      setBanner({ type: "err", text: e.message || "Failed to add MCP server" });
    } finally {
      setAddingServer(false);
    }
  };

  const openToolRunner = (server: MCPServerInfo, tool: MCPToolSchema) => {
    setActiveTool({ server, tool });
    setToolResult(null);
    const props = tool.input_schema?.properties || {};
    const defaults: Record<string, string> = {};
    Object.keys(props).forEach((key) => {
      defaults[key] = "";
    });
    setToolFormArgs(defaults);
    setToolArgsJson(JSON.stringify(defaults, null, 2));
  };

  const handleRunTool = async () => {
    if (!activeTool) return;
    setRunningTool(true);
    setToolResult(null);
    try {
      let parsedArgs: Record<string, any> = {};
      const props = activeTool.tool.input_schema?.properties || {};
      if (Object.keys(props).length > 0) {
        Object.entries(toolFormArgs).forEach(([k, v]) => {
          if (v !== "") {
            const propType = props[k]?.type;
            if (propType === "integer" || propType === "number") {
              const num = Number(v);
              parsedArgs[k] = Number.isNaN(num) ? v : num;
            } else if (propType === "boolean") {
              parsedArgs[k] = v === "true";
            } else {
              parsedArgs[k] = v;
            }
          }
        });
      } else {
        parsedArgs = JSON.parse(toolArgsJson || "{}");
      }

      const res = await api.callMCPTool(activeTool.server.id, activeTool.tool.name, parsedArgs);
      setToolResult({ is_error: res.is_error, output: res.output });
    } catch (e: any) {
      setToolResult({ is_error: true, output: e.message || "Tool execution failed" });
    } finally {
      setRunningTool(false);
    }
  };

  const filteredServers = servers.filter((srv) => {
    if (filter === "all") return true;
    if (filter === "personal") return srv.category === "personal" || srv.category === "productivity";
    return srv.category === "developer";
  });

  const connectedCount = servers.filter((s) => s.status === "connected").length;
  const totalTools = servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0);

  return (
    <div className="h-full overflow-y-auto px-4 md:px-6 py-4 space-y-5 text-slate-100 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-4 shadow-[0_0_25px_rgba(34,211,238,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-wider text-cyan-100 uppercase">
              EDITH MCP Hub
            </h2>
            <p className="text-xs text-slate-400">
              Model Context Protocol tools for developer workflows & everyday personal apps
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs font-mono text-cyan-200">
            {connectedCount}/{servers.length} Connected · {totalTools} Tools
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-medium text-cyan-100 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom MCP
          </button>
          <button
            onClick={loadServers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-xs ${
            banner.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-200"
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "all", label: "All Servers", icon: Plug },
          { id: "personal", label: "Everyday & Personal (Gmail, Calendar, WhatsApp)", icon: User },
          { id: "developer", label: "Developer & Core Tools", icon: Code2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                active
                  ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                  : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Add Custom MCP Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddServer}
          className="bg-white/[0.04] backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cyan-200">Register Custom Stdio MCP Server</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="Server ID (e.g. linear-mcp)"
              className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-xs text-slate-100 focus:border-cyan-400 outline-none"
              required
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Display Name (e.g. Linear Issues)"
              className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-xs text-slate-100 focus:border-cyan-400 outline-none"
              required
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-xs text-slate-100 focus:border-cyan-400 outline-none"
            >
              <option value="developer">Developer</option>
              <option value="personal">Personal</option>
              <option value="productivity">Productivity</option>
            </select>
            <input
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              placeholder="Command (e.g. npx, uvx, python)"
              className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-xs font-mono text-slate-100 focus:border-cyan-400 outline-none"
              required
            />
            <input
              value={newArgs}
              onChange={(e) => setNewArgs(e.target.value)}
              placeholder="Args (space-separated, e.g. -y @modelcontextprotocol/server-memory)"
              className="md:col-span-2 px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-xs font-mono text-slate-100 focus:border-cyan-400 outline-none"
            />
          </div>
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Short description of capabilities..."
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-xs text-slate-100 focus:border-cyan-400 outline-none"
          />
          <textarea
            value={newEnvText}
            onChange={(e) => setNewEnvText(e.target.value)}
            rows={2}
            placeholder={"Optional Env vars (one per line): API_KEY=your_value"}
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-xs font-mono text-slate-100 focus:border-cyan-400 outline-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingServer}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/50 text-xs font-medium text-cyan-100 transition"
            >
              {addingServer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save & Connect MCP
            </button>
          </div>
        </form>
      )}

      {/* Server Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-6">
        {filteredServers.map((srv) => {
          const isConnected = srv.status === "connected";
          const isError = srv.status === "error";
          return (
            <div
              key={srv.id}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-cyan-500/35 rounded-2xl p-4 flex flex-col justify-between gap-3 transition"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{srv.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-white/[0.06] border border-white/10 text-slate-300">
                        {srv.category}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                          isConnected
                            ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                            : isError
                            ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
                            : "bg-slate-500/15 border-slate-500/30 text-slate-400"
                        }`}
                      >
                        {isConnected ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : isError ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : null}
                        {srv.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{srv.description}</p>
                  </div>

                  <button
                    onClick={() => handleToggle(srv)}
                    disabled={togglingId === srv.id}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      srv.enabled
                        ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-rose-500/20 hover:border-rose-400/40 hover:text-rose-200"
                        : "bg-cyan-500/15 border-cyan-400/35 text-cyan-200 hover:bg-cyan-500/25"
                    }`}
                  >
                    {togglingId === srv.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                    {srv.enabled ? "Enabled" : "Enable"}
                  </button>
                </div>

                {/* Launch command */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-white/5 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">
                    {srv.command} {(srv.args || []).join(" ")}
                  </span>
                </div>

                {/* Setup Hint or Error */}
                {srv.error && (
                  <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 break-words">
                    {srv.error}
                  </div>
                )}
                {srv.setup_hint && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">{srv.setup_hint}</p>
                )}

                {/* Env Keys Configurator */}
                {(srv.env_keys?.length > 0 || editingEnvId === srv.id) && (
                  <div className="pt-1">
                    <button
                      onClick={() => openEnvEditor(srv)}
                      className="inline-flex items-center gap-1.5 text-[11px] text-cyan-300 hover:text-cyan-200"
                    >
                      <Key className="w-3 h-3" />
                      {editingEnvId === srv.id
                        ? "Close Credentials"
                        : `Configure Credentials (${srv.env_keys.join(", ")})`}
                    </button>

                    {editingEnvId === srv.id && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-950/70 border border-cyan-500/20 space-y-2">
                        {srv.env_keys.map((keyName) => (
                          <div key={keyName} className="space-y-1">
                            <label className="text-[10px] font-mono text-cyan-300">{keyName}</label>
                            <input
                              type="password"
                              value={envDraft[keyName] || ""}
                              onChange={(e) =>
                                setEnvDraft((prev) => ({ ...prev, [keyName]: e.target.value }))
                              }
                              placeholder={`Enter ${keyName}...`}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs font-mono text-slate-100 focus:border-cyan-400 outline-none"
                            />
                          </div>
                        ))}
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleSaveEnv(srv.id)}
                            disabled={savingEnv}
                            className="px-3 py-1 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/40 text-xs text-cyan-100"
                          >
                            {savingEnv ? "Saving..." : "Save & Reconnect"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Discovered Tools */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-cyan-400" />
                    Tools ({srv.tools?.length || 0})
                  </span>
                </div>
                {srv.tools && srv.tools.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {srv.tools.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => openToolRunner(srv, t)}
                        title={t.description || t.name}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/25 text-[11px] font-mono text-cyan-200 transition"
                      >
                        <Play className="w-2.5 h-2.5" />
                        {t.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Enable server to discover & invoke live MCP tools.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Tool Runner Modal */}
      {activeTool && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-950/95 border border-cyan-400/35 rounded-2xl p-5 space-y-4 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                  {activeTool.server.name} · MCP Tool
                </span>
                <h3 className="text-base font-mono font-semibold text-white">
                  {activeTool.tool.name}
                </h3>
                {activeTool.tool.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{activeTool.tool.description}</p>
                )}
              </div>
              <button
                onClick={() => setActiveTool(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {Object.keys(activeTool.tool.input_schema?.properties || {}).length > 0 ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {Object.entries(activeTool.tool.input_schema.properties).map(([key, schema]: [string, any]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-mono text-cyan-200 flex items-center justify-between">
                      <span>{key}</span>
                      <span className="text-[10px] text-slate-500">{schema?.type || "string"}</span>
                    </label>
                    <input
                      value={toolFormArgs[key] ?? ""}
                      onChange={(e) =>
                        setToolFormArgs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={schema?.description || `Enter ${key}...`}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-slate-100 focus:border-cyan-400 outline-none"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-mono text-cyan-200">Arguments (JSON)</label>
                <textarea
                  rows={3}
                  value={toolArgsJson}
                  onChange={(e) => setToolArgsJson(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-mono text-slate-100 focus:border-cyan-400 outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveTool(null)}
                className="px-3.5 py-2 rounded-lg bg-white/[0.05] text-xs text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
              <button
                onClick={handleRunTool}
                disabled={runningTool}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/50 text-xs font-medium text-cyan-100"
              >
                {runningTool ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Execute Tool
              </button>
            </div>

            {toolResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto ${
                  toolResult.is_error
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                    : "bg-slate-900/90 border-cyan-500/25 text-cyan-100"
                }`}
              >
                {toolResult.output}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

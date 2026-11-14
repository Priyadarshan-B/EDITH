import React, { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { AuditLogItem, api } from "../../api/client";

export const SecurityAuditTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(40);
      setLogs(data);
    } catch (e) {
      console.error("Failed to load audit logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "destructive_privileged":
        return "border-hudRed/50 bg-hudRed/15 text-hudRed shadow-[0_0_8px_rgba(255,42,85,0.2)]";
      case "sensitive":
        return "border-hudOrange/50 bg-hudOrange/15 text-hudOrange";
      case "low_risk_reversible":
        return "border-hudBlue/50 bg-hudBlue/15 text-hudBlue";
      default:
        return "border-hudCyan/40 bg-hudCyan/10 text-hudCyan";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "success") {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    } else if (status === "rejected") {
      return <XCircle className="w-4 h-4 text-hudRed" />;
    }
    return <AlertCircle className="w-4 h-4 text-hudOrange" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full p-6 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-hudCyan/10 border border-hudCyan flex items-center justify-center text-hudCyan shadow-hud">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-slate-100">
              Security & Authorization Vault
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Immutable ledger of desktop actions and authorization events.
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-slate-800 text-xs font-mono text-slate-300 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
        {logs.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-mono text-xs">
            No security audit entries recorded yet.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-4 rounded-2xl bg-card/70 border border-border/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusIcon(log.status)}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-slate-200">
                      {log.action_name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase font-bold ${getTierBadge(log.risk_tier)}`}>
                      {log.risk_tier}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400">
                    Mode: <span className="text-slate-300 font-medium">{log.authorization_mode}</span>
                    {log.parameters && Object.keys(log.parameters).length > 0 && (
                      <span className="ml-2 text-slate-500">
                        ({JSON.stringify(log.parameters)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-mono text-slate-500 md:text-right flex-shrink-0">
                {new Date(log.executed_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};


import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { PendingActionItem, api } from "../../api/client";

interface ActionConfirmationModalProps {
  pendingAction: PendingActionItem | null;
  onResolved: () => void;
}

export const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  pendingAction,
  onResolved,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!pendingAction) return null;

  const handleAuthorize = async () => {
    setIsSubmitting(true);
    try {
      await api.authorizeAction(pendingAction.action_id);
    } catch (e) {
      console.error("Authorization failed:", e);
    } finally {
      setIsSubmitting(false);
      onResolved();
    }
  };

  const handleDeny = async () => {
    setIsSubmitting(true);
    try {
      await api.denyAction(pendingAction.action_id);
    } catch (e) {
      console.error("Denial failed:", e);
    } finally {
      setIsSubmitting(false);
      onResolved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card/95 border-2 border-hudRed/70 rounded-3xl p-6 shadow-hudDanger flex flex-col gap-5 relative">
        {/* Header Bar */}
        <div className="flex items-center gap-3 border-b border-border/80 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-hudRed/20 border border-hudRed flex items-center justify-center text-hudRed shadow-[0_0_15px_rgba(255,42,85,0.4)] flex-shrink-0">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-hudRed uppercase font-bold">
              Security Boundary Hold
            </div>
            <h3 className="text-base font-bold font-mono text-slate-100">
              Authorization Required
            </h3>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-hudRed/10 border border-hudRed/30 flex items-start gap-2.5 text-xs text-slate-300 font-sans leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-hudRed flex-shrink-0 mt-0.5" />
          <span>
            The assistant has requested a <strong className="text-hudRed">DESTRUCTIVE / PRIVILEGED</strong> desktop operation.
            This action can permanently alter system or file state.
          </span>
        </div>

        {/* Tool & Parameters Card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Target Action:</span>
            <span className="px-2 py-0.5 rounded border border-hudRed/40 bg-hudRed/20 text-hudRed font-bold">
              {pendingAction.tool_name}
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400">Parameters:</div>
          <pre className="p-3 rounded-xl bg-black/60 border border-border/80 text-xs font-mono text-hudCyan overflow-x-auto max-h-40 scrollbar-thin">
            {JSON.stringify(pendingAction.parameters, null, 2)}
          </pre>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleDeny}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
            <span>Abort Directive</span>
          </button>

          <button
            onClick={handleAuthorize}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl border border-hudCyan bg-hudCyan/20 hover:bg-hudCyan/30 text-hudCyan font-mono text-xs uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-hudCyan" />
            <span>Authorize & Execute</span>
          </button>
        </div>
      </div>
    </div>
  );
};

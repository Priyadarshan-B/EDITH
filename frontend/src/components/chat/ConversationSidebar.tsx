import React, { useState } from "react";
import { Plus, MessageSquare, Trash2, Search } from "lucide-react";
import { ConversationItem, api } from "../../api/client";
import { useChatStore } from "../../stores/chatStore";

interface ConversationSidebarProps {
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  onSelectConversation,
  onNewConversation,
}) => {
  const { conversations, activeConversationId, setConversations } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(id);
      const updated = conversations.filter((c) => c.id !== id);
      setConversations(updated);
      if (activeConversationId === id) {
        onNewConversation();
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 border-r border-border/80 bg-card/60 backdrop-blur-xl flex flex-col h-full select-none">
      {/* Top Header & New Conversation Button */}
      <div className="p-4 border-b border-border/80 space-y-3">
        <button
          onClick={onNewConversation}
          className="w-full py-2.5 px-4 rounded-xl bg-hudCyan/15 hover:bg-hudCyan/25 border border-hudCyan/50 text-hudCyan font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Session</span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-slate-900/80 border border-border/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-hudCyan font-mono"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        <div className="px-2 py-1 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Recent Directives ({filtered.length})
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs font-mono text-slate-500">
            No sessions recorded
          </div>
        ) : (
          filtered.map((conv: ConversationItem) => {
            const isActive = activeConversationId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group px-3 py-2.5 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer ${
                  isActive
                    ? "bg-hudCyan/20 text-slate-100 border border-hudCyan/40 shadow-hud"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <MessageSquare
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isActive ? "text-hudCyan" : "text-slate-500"
                    }`}
                  />
                  <span className="truncate font-sans font-medium text-xs">{conv.title}</span>
                </div>

                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  title="Delete Session"
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-hudRed transition-opacity cursor-pointer text-slate-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-border/60 text-[10px] font-mono text-slate-500 text-center">
        Encrypted SQLite Relational Vault
      </div>
    </div>
  );
};

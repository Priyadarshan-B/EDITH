import React, { useState, useEffect } from "react";
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { api, UserFactItem, SemanticQueryResultItem } from "../../api/client";

export const MemoryTab: React.FC = () => {
  const [facts, setFacts] = useState<UserFactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SemanticQueryResultItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // New fact modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("preference");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFacts = async () => {
    setLoading(true);
    try {
      const data = await api.getFacts();
      setFacts(data);
    } catch (e) {
      console.error("Failed to load user facts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacts();
  }, []);

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.queryMemory(searchQuery, 6);
      setSearchResults(results);
    } catch (e) {
      console.error("Vector search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteFact(id);
      setFacts((prev) => prev.filter((f) => f.id !== id));
      if (searchResults) {
        setSearchResults((prev) => prev?.filter((r) => r.id !== id) || null);
      }
    } catch (e) {
      console.error("Failed to delete fact:", e);
    }
  };

  const handleCreateFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await api.createFact(newContent, newCategory, 1.0);
      setFacts((prev) => [created, ...prev]);
      setNewContent("");
      setIsModalOpen(false);
    } catch (e) {
      console.error("Failed to create fact:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ["all", "preference", "personal", "environment", "project"];

  const filteredFacts = facts.filter((f) => {
    if (activeCategory === "all") return true;
    return f.category.toLowerCase() === activeCategory.toLowerCase();
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f18]/80 backdrop-blur-md overflow-hidden text-slate-200">
      {/* HUD Header */}
      <div className="p-4 border-b border-cyan-500/20 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Brain className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold tracking-wider text-cyan-400 uppercase font-mono">
                Semantic Memory & Vector Index
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                ChromaDB + FastEmbed
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Persistent user preferences, episodic memories, and context retrieval
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition-all shadow-[0_0_10px_rgba(6,182,212,0.1)] active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Store Fact</span>
          </button>
          <button
            onClick={fetchFacts}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 transition-colors"
            title="Refresh Knowledge Index"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Semantic Probe Bar */}
      <div className="p-4 border-b border-slate-800/60 bg-slate-950/20">
        <form onSubmit={handleSemanticSearch} className="relative flex items-center">
          <Search className="w-4 h-4 text-cyan-500/70 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Test dense vector search across stored memory (e.g., 'coding tools', 'visual preferences')..."
            className="w-full pl-9 pr-24 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
          />
          <div className="absolute right-2 flex items-center space-x-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching}
              className="px-3 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition-all"
            >
              {isSearching ? "Searching..." : "Vector Query"}
            </button>
          </div>
        </form>

        {/* Category Filters */}
        <div className="flex items-center space-x-2 mt-3 overflow-x-auto pb-1">
          <span className="text-[11px] text-slate-400 font-mono flex items-center space-x-1 mr-1">
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span>Category:</span>
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setSearchResults(null);
              }}
              className={`px-2.5 py-1 rounded text-xs font-mono capitalize transition-all border ${
                activeCategory === cat && !searchResults
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              {cat}
            </button>
          ))}
          {searchResults && (
            <span className="text-[11px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              Semantic Results: {searchResults.length}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {searchResults !== null ? (
          // Semantic Vector Results View
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-cyan-500/20">
              <span className="text-xs font-mono text-cyan-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Vector Semantic Similarity Results for &quot;{searchQuery}&quot;</span>
              </span>
              <button
                onClick={handleClearSearch}
                className="text-xs text-slate-400 hover:text-cyan-300 underline font-mono"
              >
                Back to all facts
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No matching memory vectors found above similarity threshold.
              </div>
            ) : (
              searchResults.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-lg bg-slate-900/70 border border-cyan-500/30 hover:border-cyan-400/60 transition-all shadow-[0_0_12px_rgba(6,182,212,0.06)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono uppercase border border-cyan-500/30">
                          {item.category}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Similarity: {(Math.max(0, 1 - item.distance) * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 font-medium leading-relaxed">
                        {item.content}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors"
                      title="Forget Memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Accessing memory core...</span>
          </div>
        ) : filteredFacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300 font-mono">No Knowledge Stored Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                EDITH automatically extracts facts and habits as you talk, or you can register memories manually.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition-all"
            >
              + Store First Memory
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFacts.map((fact) => (
              <div
                key={fact.id}
                className="group p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 transition-all relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono uppercase border border-slate-700/60">
                        {fact.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{new Date(fact.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {fact.fact_content}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(fact.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded transition-opacity"
                    title="Forget Memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for adding a fact manually */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-cyan-500/40 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-cyan-400 font-mono text-sm font-semibold">
                <Brain className="w-4 h-4" />
                <span>Store Long-Term Fact</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFact} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="preference">Preference (Styling, conventions, habits)</option>
                  <option value="personal">Personal (Identity, role, preferences)</option>
                  <option value="project">Project (Active repos, paths, stack)</option>
                  <option value="environment">Environment (OS, IDE, terminal, hardware)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  Fact / Instruction Content
                </label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g., User prefers TypeScript with strict mode enabled and Tailwind CSS for styling."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-sans focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 text-xs font-mono border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newContent.trim()}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 text-xs font-mono transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] disabled:opacity-50"
                >
                  {isSubmitting ? "Committing..." : "Commit to Memory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

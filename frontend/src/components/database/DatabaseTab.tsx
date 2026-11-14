import React, { useState, useEffect } from "react";
import {
  Database,
  Table,
  RefreshCw,
  Search,
  HardDrive,
  CheckCircle2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { api } from "../../api/client";

interface TableInfo {
  name: string;
  row_count: number;
  columns: { cid: number; name: string; type: string; pk: boolean }[];
}

export const DatabaseTab: React.FC = () => {
  const [dbPath, setDbPath] = useState("");
  const [sizeKb, setSizeKb] = useState(0);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("messages");
  const [loadingDb, setLoadingDb] = useState(true);

  // Table rows & pagination state
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<{ cid: number; name: string; type: string; pk: boolean }[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [limit] = useState(30);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const fetchDbInfo = async () => {
    setLoadingDb(true);
    try {
      const data = await api.getDatabaseInfo();
      setDbPath(data.path);
      setSizeKb(data.size_kb);
      setTables(data.tables || []);
      if (data.tables && data.tables.length > 0 && !selectedTable) {
        setSelectedTable(data.tables[0].name);
      }
    } catch (e) {
      console.error("Failed to load DB info:", e);
    } finally {
      setLoadingDb(false);
    }
  };

  const fetchTableRows = async () => {
    if (!selectedTable) return;
    setLoadingRows(true);
    try {
      const data = await api.getTableData(selectedTable, limit, offset, search);
      setColumns(data.columns || []);
      setRows(data.rows || []);
      setTotalRows(data.total_rows || 0);
    } catch (e) {
      console.error("Failed to load table rows:", e);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    fetchDbInfo();
  }, []);

  useEffect(() => {
    fetchTableRows();
  }, [selectedTable, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchTableRows();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(id);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const totalPages = Math.ceil(totalRows / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f18]/80 backdrop-blur-md overflow-hidden text-slate-200 select-none">
      {/* Top Database HUD Bar */}
      <div className="p-4 border-b border-border/80 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hudCyan/10 border border-hudCyan/40 flex items-center justify-center text-hudCyan shadow-[0_0_12px_rgba(0,240,255,0.2)]">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wider text-slate-100 font-mono uppercase">
                SQLite State Vault & Table Explorer
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Live Saving Active
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
              <HardDrive className="w-3.5 h-3.5 text-hudCyan" />
              <span className="truncate max-w-md" title={dbPath}>
                {dbPath || "data/edith.db"}
              </span>
              <span className="text-slate-500">({sizeKb} KB on disk)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={() => {
              fetchDbInfo();
              fetchTableRows();
            }}
            disabled={loadingDb || loadingRows}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-border/60 hover:border-hudCyan/40 text-slate-300 hover:text-hudCyan text-xs font-mono transition-all cursor-pointer shadow-sm"
            title="Refresh database schema and live row counts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDb || loadingRows ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Area (Left Tables Sidebar + Right Table Grid) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tables Sidebar */}
        <div className="w-56 border-r border-border/80 bg-slate-950/30 flex flex-col justify-between shrink-0 p-3 space-y-2">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase px-2 mb-2 block">
              Tables in Database ({tables.length})
            </span>
            <div className="space-y-1">
              {tables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setSelectedTable(t.name);
                    setOffset(0);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                    selectedTable === t.name
                      ? "bg-hudCyan/15 border-hudCyan/50 text-hudCyan shadow-[0_0_10px_rgba(0,240,255,0.15)] font-semibold"
                      : "bg-slate-900/40 border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Table className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      selectedTable === t.name
                        ? "bg-hudCyan/30 text-hudCyan"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {t.row_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Micro Helper Note */}
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-[11px] font-mono text-slate-400">
            <span className="text-hudCyan block font-bold mb-0.5">Beekeeper Studio Tip:</span>
            Point to <code className="text-[10px] text-slate-200">data\edith.db</code> in this project folder to inspect with external tools.
          </div>
        </div>

        {/* Right Table View & Data Grid */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
          {/* Table Header Filter & Search Toolbar */}
          <div className="p-3 border-b border-border/80 flex items-center justify-between gap-3 bg-slate-950/30">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search rows in '${selectedTable}'...`}
                className="w-full pl-8 pr-16 py-1.5 bg-slate-900/90 border border-border/60 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-hudCyan/60 font-mono"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 px-2 py-0.5 rounded-lg bg-hudCyan/20 text-hudCyan text-[11px] font-mono hover:bg-hudCyan/30 transition-colors"
              >
                Filter
              </button>
            </form>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>
                Page {currentPage} of {totalPages} ({totalRows} rows)
              </span>
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || loadingRows}
                className="p-1 rounded-lg border border-border/60 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages || loadingRows}
                className="p-1 rounded-lg border border-border/60 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Grid Content */}
          <div className="flex-1 overflow-auto p-4 scrollbar-thin">
            {loadingRows ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 font-mono text-xs space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin text-hudCyan" />
                <span>Loading live rows from SQLite...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 font-mono text-xs space-y-2">
                <FileSpreadsheet className="w-8 h-8 opacity-40 text-hudCyan" />
                <span>No records found in table &apos;{selectedTable}&apos;.</span>
              </div>
            ) : (
              <div className="border border-border/70 rounded-xl overflow-hidden shadow-sm bg-slate-950/60">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-border/80 text-slate-300">
                      {columns.map((col) => (
                        <th key={col.name} className="px-3 py-2.5 font-semibold text-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{col.name}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 uppercase">
                              {col.type || "TEXT"}
                            </span>
                            {col.pk && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                PK
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-hudCyan/5 transition-colors group"
                      >
                        {columns.map((col) => {
                          const val = row[col.name];
                          const strVal = val === null || val === undefined ? "NULL" : typeof val === "object" ? JSON.stringify(val) : String(val);
                          const cellId = `${rIdx}_${col.name}`;

                          return (
                            <td
                              key={col.name}
                              className="px-3 py-2 max-w-xs truncate text-[11px] text-slate-300 group-hover:text-slate-100"
                              title={strVal}
                            >
                              <div className="flex items-center justify-between gap-1 group/cell">
                                <span className={val === null ? "text-slate-600 italic" : ""}>
                                  {strVal}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(strVal, cellId)}
                                  className="opacity-0 group-hover/cell:opacity-100 p-0.5 hover:text-hudCyan text-slate-500 transition-opacity"
                                  title="Copy cell value"
                                >
                                  {copiedCell === cellId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


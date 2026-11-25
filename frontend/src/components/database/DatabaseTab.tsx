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
  Filter,
  ArrowUpDown,
  X,
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

  // Table rows, filters, sorting & pagination state
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<{ cid: number; name: string; type: string; pk: boolean }[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
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
      const data = await api.getTableData(
        selectedTable,
        limit,
        offset,
        search,
        filterCol || undefined,
        filterVal || undefined,
        sortCol || undefined,
        sortDir
      );
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
  }, [selectedTable, offset, limit, sortCol, sortDir]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (offset !== 0) {
      setOffset(0);
    } else {
      fetchTableRows();
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setFilterCol("");
    setFilterVal("");
    setSortCol("");
    setSortDir("desc");
    setOffset(0);
    setTimeout(fetchTableRows, 0);
  };

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(colName);
      setSortDir("asc");
    }
    setOffset(0);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(id);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const totalPages = Math.max(1, Math.ceil(totalRows / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const startRow = totalRows === 0 ? 0 : offset + 1;
  const endRow = Math.min(totalRows, offset + rows.length);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/30 backdrop-blur-xl overflow-hidden text-slate-200 select-none">
      {/* Top Database HUD Bar */}
      <div className="p-4 border-b border-cyan-400/20 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hudCyan/10 border border-hudCyan/40 flex items-center justify-center text-hudCyan shadow-hud">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold tracking-wider text-slate-100 font-display uppercase">
                SQLite State Vault &amp; Table Explorer
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
              <span className="text-slate-500">({sizeKb} KB)</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            fetchDbInfo();
            fetchTableRows();
          }}
          disabled={loadingDb || loadingRows}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-cyan-400/20 hover:border-hudCyan/50 text-slate-300 hover:text-hudCyan text-xs font-mono transition-all cursor-pointer self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingDb || loadingRows ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Tables Selector */}
        <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-cyan-400/15 bg-slate-950/35 flex flex-row md:flex-col justify-between shrink-0 p-3 gap-2 overflow-x-auto md:overflow-y-auto">
          <div className="flex md:flex-col gap-1.5 w-full">
            <span className="hidden md:block text-[10px] font-mono tracking-widest text-slate-500 uppercase px-2 mb-1">
              Tables ({tables.length})
            </span>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  setSelectedTable(t.name);
                  setOffset(0);
                  setSearch("");
                  setFilterCol("");
                  setFilterVal("");
                  setSortCol("");
                }}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border shrink-0 md:w-full ${
                  selectedTable === t.name
                    ? "bg-hudCyan/15 border-hudCyan/50 text-hudCyan shadow-[0_0_10px_rgba(0,240,255,0.15)] font-semibold"
                    : "bg-slate-900/40 border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Table className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </div>
                <span className="text-[10px] px-1.5 rounded bg-slate-800/80 text-slate-300">
                  {t.row_count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Table View & Data Grid */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/15">
          {/* Search + Column Filter + Page Size Toolbar */}
          <form
            onSubmit={handleSearchSubmit}
            className="p-3 border-b border-cyan-400/15 flex flex-wrap items-center justify-between gap-2 bg-slate-950/30"
          >
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Global search in '${selectedTable}'...`}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900/80 border border-border/60 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-hudCyan/60 font-mono"
                />
              </div>

              {/* Column Filter */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 border border-border/60 rounded-xl px-2 py-1">
                <Filter className="w-3.5 h-3.5 text-hudCyan shrink-0" />
                <select
                  value={filterCol}
                  onChange={(e) => setFilterCol(e.target.value)}
                  className="bg-transparent text-xs font-mono text-slate-300 focus:outline-none"
                >
                  <option value="" className="bg-slate-950">All columns</option>
                  {columns.map((c) => (
                    <option key={c.name} value={c.name} className="bg-slate-950">
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={filterVal}
                  onChange={(e) => setFilterVal(e.target.value)}
                  placeholder="Equals/contains..."
                  disabled={!filterCol}
                  className="w-28 bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-0.5 text-xs font-mono text-slate-200 placeholder-slate-500 disabled:opacity-40 focus:outline-none focus:border-hudCyan/50"
                />
              </div>

              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-hudCyan/20 border border-hudCyan/40 text-hudCyan text-xs font-mono hover:bg-hudCyan/30 transition-colors cursor-pointer"
              >
                Apply
              </button>

              {(search || filterVal || sortCol) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-border/60 text-slate-400 hover:text-slate-200 text-xs font-mono cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Rows per page + Pagination Controls */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setOffset(0);
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 border border-border/60 text-xs font-mono text-slate-200"
                title="Rows per page"
              >
                {[10, 25, 50, 100].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz} / page
                  </option>
                ))}
              </select>

              <span className="hidden sm:inline">
                {startRow}-{endRow} of {totalRows}
              </span>

              <button
                type="button"
                onClick={() => setOffset(0)}
                disabled={offset === 0 || loadingRows}
                className="px-2 py-1 rounded-lg border border-border/60 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                title="First page"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || loadingRows}
                className="p-1 rounded-lg border border-border/60 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-hudCyan font-semibold">
                {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages || loadingRows}
                className="p-1 rounded-lg border border-border/60 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOffset(Math.max(0, (totalPages - 1) * limit))}
                disabled={currentPage >= totalPages || loadingRows}
                className="px-2 py-1 rounded-lg border border-border/60 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                title="Last page"
              >
                {totalPages}
              </button>
            </div>
          </form>

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
                <span>No matching records in &apos;{selectedTable}&apos;.</span>
              </div>
            ) : (
              <div className="border border-cyan-400/20 rounded-xl overflow-hidden shadow-sm bg-slate-950/50 backdrop-blur-md">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-cyan-400/20 text-slate-300">
                      {columns.map((col) => (
                        <th
                          key={col.name}
                          onClick={() => handleSort(col.name)}
                          className="px-3 py-2.5 font-semibold text-[11px] whitespace-nowrap cursor-pointer hover:text-hudCyan select-none"
                          title={`Click to sort by ${col.name}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{col.name}</span>
                            <ArrowUpDown
                              className={`w-3 h-3 ${
                                sortCol === col.name ? "text-hudCyan" : "text-slate-600"
                              }`}
                            />
                            {sortCol === col.name && (
                              <span className="text-[9px] text-hudCyan uppercase">{sortDir}</span>
                            )}
                            {col.pk && (
                              <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
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
                      <tr key={rIdx} className="hover:bg-hudCyan/5 transition-colors group">
                        {columns.map((col) => {
                          const val = row[col.name];
                          const strVal =
                            val === null || val === undefined
                              ? "NULL"
                              : typeof val === "object"
                              ? JSON.stringify(val)
                              : String(val);
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

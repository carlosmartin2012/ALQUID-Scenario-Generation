import { useState, useRef, useCallback, useEffect, MutableRefObject, ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { GoogleGenAI } from '@google/genai';
import {
    Play, Plus, Trash2, Sparkles, X, Loader2, ChevronDown, ChevronUp,
    Code2, FileText, Upload, Link, Database, Terminal, Check,
    RefreshCw, Paperclip, Globe, BookOpen, AlertCircle, DownloadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type CellType = 'code' | 'markdown';
type CellStatus = 'idle' | 'running' | 'success' | 'error';

interface OutputLine {
    type: 'log' | 'error' | 'table' | 'json';
    content: string;
}

interface Cell {
    id: string;
    type: CellType;
    source: string;
    output: OutputLine[];
    status: CellStatus;
    executionCount: number;
}

interface Dataset {
    name: string;
    rows: Record<string, string>[];
    source: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
    return Math.random().toString(36).slice(2);
}

function parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    });
}

const OFFICIAL_SOURCES = [
    { label: 'INE', url: 'https://www.ine.es', icon: '🇪🇸', description: 'Instituto Nacional de Estadística' },
    { label: 'BdE', url: 'https://www.bde.es', icon: '🏦', description: 'Banco de España' },
    { label: 'BCE', url: 'https://www.ecb.europa.eu', icon: '🇪🇺', description: 'Banco Central Europeo' },
    { label: 'EBA', url: 'https://www.eba.europa.eu', icon: '📋', description: 'European Banking Authority' },
    { label: 'ESRB', url: 'https://www.esrb.europa.eu', icon: '🔍', description: 'European Systemic Risk Board' },
    { label: 'FMI', url: 'https://www.imf.org', icon: '🌐', description: 'Fondo Monetario Internacional' },
];

const STARTER_CODE = `# ALQUID Scenario Generator — Notebook
# ─────────────────────────────────────
# Puedes usar print(), table(), loadData(), y el objecto 'scenario'

# Ejemplo: crear un escenario con shocks de tipos
scenario.name = "Q1 2026 - Stress Subida Tipos"
scenario.base_date = "2026-01-31"

macro = {
    "gdp_growth": -0.5,
    "unemployment_rate": 8.2,
    "cpi": 4.1
}

rates = {
    "curve_type": "parallel_shift",
    "shift_bp": 200,
    "shocks": [
        {"term": "3M", "value": 150},
        {"term": "1Y", "value": 200},
        {"term": "5Y", "value": 200},
        {"term": "10Y", "value": 175},
    ]
}

scenario.set("macro", macro)
scenario.set("rates", rates)

print("✅ Escenario configurado: " + scenario.name)
table(scenario.summary())
`;

// ─── Code Execution Engine ───────────────────────────────────────────────────

function buildRuntime(datasets: Dataset[], output: OutputLine[], scenarioRef: MutableRefObject<Record<string, unknown>>) {
    const logs = output;

    const print = (...args: unknown[]) => {
        logs.push({ type: 'log', content: args.map(a => String(a)).join(' ') });
    };

    const table = (data: unknown) => {
        try {
            logs.push({ type: 'table', content: JSON.stringify(data, null, 2) });
        } catch {
            logs.push({ type: 'log', content: String(data) });
        }
    };

    const loadData = (name: string) => {
        const ds = datasets.find(d => d.name === name);
        if (!ds) { logs.push({ type: 'error', content: `Dataset '${name}' not found.` }); return []; }
        logs.push({ type: 'log', content: `📂 Loaded dataset '${name}' (${ds.rows.length} rows)` });
        return ds.rows;
    };

    const scenario = {
        name: scenarioRef.current['name'] ?? 'Unnamed',
        base_date: scenarioRef.current['base_date'] ?? new Date().toISOString().split('T')[0],
        _params: { ...(scenarioRef.current['_params'] as object ?? {}) } as Record<string, unknown>,
        set(block: string, val: unknown) {
            this._params[block] = val;
            scenarioRef.current = { ...scenarioRef.current, _params: this._params };
            logs.push({ type: 'log', content: `📝 Block '${block}' updated.` });
        },
        summary() {
            return {
                name: this.name,
                base_date: this.base_date,
                blocks: Object.keys(this._params),
                params: this._params,
            };
        }
    };

    // Translate Python-ish syntax to JS before eval
    const transpile = (src: string) =>
        src
            .replace(/^#.*$/gm, '//$&')                          // # comments → //
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/\bNone\b/g, 'null')
            .replace(/\bprint\s*\(/g, 'print(')
            .replace(/\btable\s*\(/g, 'table(')
            .replace(/\bloadData\s*\(/g, 'loadData(')
            .replace(/f"([^"]*)"/g, (_, s) => '`' + s.replace(/\{([^}]+)\}/g, '${$1}') + '`');

    return { print, table, loadData, scenario, transpile };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScenarioNotebook() {
    const [cells, setCells] = useState<Cell[]>([
        { id: uid(), type: 'code', source: STARTER_CODE, output: [], status: 'idle', executionCount: 0 },
    ]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [activeCell, setActiveCell] = useState<string | null>(null);
    const [copilotOpen, setCopilotOpen] = useState(true);
    const [importOpen, setImportOpen] = useState(false);
    const [copilotPrompt, setCopilotPrompt] = useState('');
    const [copilotLoading, setCopilotLoading] = useState(false);
    const [copilotResult, setCopilotResult] = useState<string | null>(null);
    const [copilotError, setCopilotError] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState('');
    const [urlLoading, setUrlLoading] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [execCount, setExecCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scenarioRef = useRef<Record<string, unknown>>({});

    // ── Cell mutations ──────────────────────────────────────────────────────────

    const addCell = (type: CellType = 'code', afterId?: string) => {
        const newCell: Cell = { id: uid(), type, source: '', output: [], status: 'idle', executionCount: 0 };
        setCells(prev => {
            if (!afterId) return [...prev, newCell];
            const idx = prev.findIndex(c => c.id === afterId);
            return [...prev.slice(0, idx + 1), newCell, ...prev.slice(idx + 1)];
        });
        setActiveCell(newCell.id);
    };

    const updateSource = (id: string, source: string) => {
        setCells(prev => prev.map(c => c.id === id ? { ...c, source } : c));
    };

    const deleteCell = (id: string) => {
        setCells(prev => prev.filter(c => c.id !== id));
    };

    const clearOutput = (id: string) => {
        setCells(prev => prev.map(c => c.id === id ? { ...c, output: [], status: 'idle' } : c));
    };

    // ── Execution ──────────────────────────────────────────────────────────────

    const runCell = useCallback(async (id: string) => {
        const cell = cells.find(c => c.id === id);
        if (!cell || cell.type !== 'code') return;

        setCells(prev => prev.map(c => c.id === id ? { ...c, status: 'running', output: [] } : c));

        const output: OutputLine[] = [];
        const { print, table, loadData, scenario, transpile } = buildRuntime(datasets, output, scenarioRef);

        try {
            const js = transpile(cell.source);
            // eslint-disable-next-line no-new-func
            const fn = new Function('print', 'table', 'loadData', 'scenario', js);
            await fn(print, table, loadData, scenario);
            setExecCount(n => n + 1);
            setCells(prev => prev.map(c =>
                c.id === id ? { ...c, status: 'success', output, executionCount: execCount + 1 } : c
            ));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            output.push({ type: 'error', content: msg });
            setCells(prev => prev.map(c =>
                c.id === id ? { ...c, status: 'error', output } : c
            ));
        }
    }, [cells, datasets, execCount]);

    const runAll = async () => {
        for (const cell of cells) {
            if (cell.type === 'code') await runCell(cell.id);
        }
    };

    // ── Data Import: File ──────────────────────────────────────────────────────

    const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const rows = parseCSV(text);
            const name = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
            setDatasets(prev => {
                const exists = prev.findIndex(d => d.name === name);
                if (exists >= 0) {
                    const updated = [...prev];
                    updated[exists] = { name, rows, source: file.name };
                    return updated;
                }
                return [...prev, { name, rows, source: file.name }];
            });
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Data Import: URL ───────────────────────────────────────────────────────

    const handleUrlImport = async () => {
        if (!urlInput.trim()) return;
        setUrlLoading(true);
        setUrlError(null);
        try {
            // Use a CORS proxy for external URLs
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlInput.trim())}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const rows = parseCSV(text);
            if (rows.length === 0) throw new Error('No se pudo parsear el CSV de la URL. Verifica el formato.');
            const name = 'url_import_' + Date.now();
            setDatasets(prev => [...prev, { name, rows, source: urlInput.trim() }]);
            setUrlInput('');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al importar desde URL';
            setUrlError(msg);
        } finally {
            setUrlLoading(false);
        }
    };

    // ── Copilot ────────────────────────────────────────────────────────────────

    const handleCopilot = async () => {
        if (!copilotPrompt.trim()) return;
        setCopilotLoading(true);
        setCopilotError(null);
        setCopilotResult(null);
        try {
            const apiKey = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env.VITE_GEMINI_API_KEY
                ?? (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
            if (!apiKey) throw new Error('Gemini API Key no configurada.');
            const ai = new GoogleGenAI({ apiKey });
            const systemPrompt = `Eres un experto en ALM (Asset & Liability Management) y programación. 
Genera código JavaScript (estilo Python con comentarios #) para el notebook de ALQUID Scenario Generator.

APIs disponibles:
- print(msg)  — muestra texto en el output
- table(obj)  — muestra un objeto/array como tabla
- loadData(name) — carga un dataset importado por su nombre (retorna array de {col: val})
- scenario.name = "..."
- scenario.base_date = "YYYY-MM-DD"
- scenario.set("macro", { gdp_growth, unemployment_rate, cpi })
- scenario.set("rates", { curve_type, shift_bp, shocks: [{term, value}] })
- scenario.set("inflation", { nominal_configuration: {name, shock}, real_configuration: {name, shock} })
- scenario.summary() — retorna resumen del escenario

IMPORTANTE: Devuelve SOLO el bloque de código, sin markdown ni texto adicional.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: `Genera código para: "${copilotPrompt}"`,
                config: { systemInstruction: systemPrompt }
            });
            const code = response.text?.trim() ?? '';
            setCopilotResult(code.replace(/^```[\w]*\n?/, '').replace(/```$/, ''));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al generar código.';
            setCopilotError(msg);
        } finally {
            setCopilotLoading(false);
        }
    };

    const insertCopilotCode = () => {
        if (!copilotResult) return;
        const newCell: Cell = { id: uid(), type: 'code', source: copilotResult, output: [], status: 'idle', executionCount: 0 };
        setCells(prev => [...prev, newCell]);
        setActiveCell(newCell.id);
        setCopilotResult(null);
        setCopilotPrompt('');
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-slate-200 font-sans overflow-hidden">

            {/* ── Top Bar ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-[#161b22] border-b border-[#30363d]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                            <Code2 className="w-4 h-4 text-indigo-400" />
                        </div>
                        <span className="font-bold text-slate-200 text-sm tracking-tight">Scenario Notebook</span>
                    </div>

                    <div className="h-4 w-px bg-[#30363d]" />

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => addCell('code')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#21262d] hover:text-white rounded-lg transition-colors border border-[#30363d]"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Code
                        </button>
                        <button
                            onClick={() => addCell('markdown')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#21262d] hover:text-white rounded-lg transition-colors border border-[#30363d]"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Markdown
                        </button>
                        <button
                            onClick={runAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                        >
                            <Play className="w-3.5 h-3.5" />
                            Run All
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Datasets badge */}
                    {datasets.length > 0 && (
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-900/40 text-violet-300 border border-violet-500/30 rounded-lg text-xs font-medium cursor-pointer hover:bg-violet-900/60"
                            onClick={() => setImportOpen(true)}
                        >
                            <Database className="w-3.5 h-3.5" />
                            {datasets.length} dataset{datasets.length > 1 ? 's' : ''}
                        </div>
                    )}
                    <button
                        onClick={() => setImportOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#21262d] rounded-lg transition-colors border border-[#30363d]"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        Import Data
                    </button>
                    <button
                        onClick={() => setCopilotOpen(v => !v)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border",
                            copilotOpen
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "text-slate-300 hover:bg-[#21262d] border-[#30363d]"
                        )}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Copilot
                    </button>
                </div>
            </div>

            {/* ── Main ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── Cells ── */}
                <div className="flex-1 overflow-y-auto py-4 px-0">
                    <div className="max-w-4xl mx-auto space-y-2 px-4">
                        {cells.map((cell, idx) => (
                            <NotebookCell
                                key={cell.id}
                                cell={cell}
                                index={idx}
                                isActive={activeCell === cell.id}
                                onActivate={() => setActiveCell(cell.id)}
                                onRun={() => runCell(cell.id)}
                                onDelete={() => deleteCell(cell.id)}
                                onChange={(src) => updateSource(cell.id, src)}
                                onClearOutput={() => clearOutput(cell.id)}
                                onAddAfter={(type) => addCell(type, cell.id)}
                            />
                        ))}

                        {/* Add button at bottom */}
                        <button
                            onClick={() => addCell('code')}
                            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#30363d] rounded-xl text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Cell
                        </button>
                    </div>
                </div>

                {/* ── Copilot Sidebar ── */}
                <AnimatePresence>
                    {copilotOpen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 360, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="flex-shrink-0 border-l border-[#30363d] bg-[#161b22] flex flex-col overflow-hidden"
                        >
                            <CopilotPanel
                                prompt={copilotPrompt}
                                onPromptChange={setCopilotPrompt}
                                onGenerate={handleCopilot}
                                loading={copilotLoading}
                                result={copilotResult}
                                error={copilotError}
                                onInsert={insertCopilotCode}
                                onDiscard={() => { setCopilotResult(null); setCopilotPrompt(''); }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Import Modal ── */}
            <AnimatePresence>
                {importOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-[#30363d]">
                                <div className="flex items-center gap-2">
                                    <Database className="w-5 h-5 text-violet-400" />
                                    <span className="font-bold text-slate-100 text-base">Import Data</span>
                                </div>
                                <button onClick={() => setImportOpen(false)} className="text-slate-400 hover:text-slate-200">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* File upload */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Upload File</p>
                                    <div
                                        className="border-2 border-dashed border-[#30363d] hover:border-violet-500 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="w-8 h-8 text-slate-500" />
                                        <p className="text-sm text-slate-400">Click to upload <span className="text-violet-400 font-medium">.csv</span> or <span className="text-violet-400 font-medium">.txt</span></p>
                                        <p className="text-xs text-slate-500">El dataset estará disponible con <code className="bg-[#21262d] px-1 rounded">loadData("nombre")</code></p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,.txt"
                                            aria-label="Import CSV or TXT file"
                                            className="hidden"
                                            onChange={handleFileImport}
                                        />
                                    </div>
                                </div>

                                {/* URL import */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Import from URL</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={urlInput}
                                            onChange={e => setUrlInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
                                            placeholder="https://www.bde.es/...csv"
                                            className="flex-1 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                                        />
                                        <button
                                            onClick={handleUrlImport}
                                            disabled={urlLoading}
                                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                                            Fetch
                                        </button>
                                    </div>
                                    {urlError && (
                                        <div className="mt-2 flex items-center gap-1.5 text-red-400 text-xs">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {urlError}
                                        </div>
                                    )}

                                    {/* Quick links */}
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {OFFICIAL_SOURCES.map(src => (
                                            <a
                                                key={src.label}
                                                href={src.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={src.description}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-[#0d1117] border border-[#30363d] hover:border-violet-500 rounded-lg text-xs text-slate-300 hover:text-slate-100 transition-colors"
                                            >
                                                <span>{src.icon}</span>
                                                <span className="font-medium">{src.label}</span>
                                                <Globe className="w-3 h-3 ml-auto opacity-40" />
                                            </a>
                                        ))}
                                    </div>
                                </div>

                                {/* Loaded datasets */}
                                {datasets.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Loaded Datasets</p>
                                        <div className="space-y-1.5">
                                            {datasets.map((ds, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <Database className="w-3.5 h-3.5 text-violet-400" />
                                                        <code className="text-violet-300 font-mono">{ds.name}</code>
                                                        <span className="text-slate-500">({ds.rows.length} rows)</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setDatasets(prev => prev.filter((_, j) => j !== i))}
                                                        className="text-slate-500 hover:text-red-400"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-5 py-4 border-t border-[#30363d] flex justify-end">
                                <button
                                    onClick={() => setImportOpen(false)}
                                    className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-slate-300 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── NotebookCell ─────────────────────────────────────────────────────────────

interface CellProps {
    cell: Cell;
    index: number;
    isActive: boolean;
    onActivate: () => void;
    onRun: () => void;
    onDelete: () => void;
    onChange: (src: string) => void;
    onClearOutput: () => void;
    onAddAfter: (type: CellType) => void;
}

function NotebookCell({ cell, index, isActive, onActivate, onRun, onDelete, onChange, onClearOutput, onAddAfter }: CellProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.max(textareaRef.current.scrollHeight, 80) + 'px';
        }
    }, [cell.source]);

    const handleKeyDown = (e: ReactKeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            onRun();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newVal = cell.source.slice(0, start) + '    ' + cell.source.slice(end);
            onChange(newVal);
            requestAnimationFrame(() => {
                if (ta) { ta.selectionStart = ta.selectionEnd = start + 4; }
            });
        }
    };

    const statusColor = {
        idle: 'border-[#30363d]',
        running: 'border-amber-500',
        success: 'border-emerald-500',
        error: 'border-red-500',
    }[cell.status];

    return (
        <div
            className={cn(
                "group rounded-xl border transition-all duration-150",
                isActive ? statusColor : 'border-[#21262d] hover:border-[#30363d]',
                'bg-[#161b22]'
            )}
            onClick={onActivate}
        >
            {/* Cell header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#21262d]">
                <span className="text-xs font-mono text-slate-600 w-6 text-right flex-shrink-0">
                    {cell.type === 'code' ? `[${cell.executionCount > 0 ? cell.executionCount : ' '}]` : 'MD'}
                </span>
                <span className="text-xs text-slate-500 flex-1">{cell.type === 'code' ? 'JavaScript (Python-like)' : 'Markdown'}</span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {cell.type === 'code' && cell.output.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); onClearOutput(); }} title="Clear output" className="p-1 text-slate-500 hover:text-slate-300 rounded">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onAddAfter('code'); }} title="Add cell below" className="p-1 text-slate-500 hover:text-slate-300 rounded">
                        <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete cell" className="p-1 text-slate-500 hover:text-red-400 rounded">
                        <Trash2 className="w-3 h-3" />
                    </button>
                    {cell.type === 'code' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRun(); }}
                            disabled={cell.status === 'running'}
                            title="Run (Ctrl+Enter)"
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium disabled:opacity-50"
                        >
                            {cell.status === 'running'
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Play className="w-3 h-3" />}
                            Run
                        </button>
                    )}
                </div>
            </div>

            {/* Code editor */}
            <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col items-end pr-2 pt-3 select-none text-[11px] font-mono text-[#3a4050] leading-5 border-r border-[#21262d]">
                    {cell.source.split('\n').map((_, i) => (
                        <div key={i} className="leading-5">{i + 1}</div>
                    ))}
                </div>
                <textarea
                    ref={textareaRef}
                    value={cell.source}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onClick={e => e.stopPropagation()}
                    spellCheck={false}
                    aria-label={`Cell ${index + 1} code editor`}
                    placeholder={cell.type === 'code' ? '# Escribe código aquí…\nprint("Hello, ALQUID!")' : 'Escribe texto en markdown…'}
                    className={cn(
                        "w-full pl-12 pr-4 pt-3 pb-3 font-mono text-sm leading-5 resize-none focus:outline-none bg-transparent",
                        cell.type === 'code' ? 'text-emerald-300' : 'text-slate-300 italic'
                    )}
                    style={{ minHeight: '80px' }}
                />
            </div>

            {/* Output */}
            {cell.output.length > 0 && (
                <div className="border-t border-[#21262d] bg-[#0d1117] rounded-b-xl overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#21262d]">
                        <Terminal className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Output</span>
                        {cell.status === 'success' && <Check className="w-3 h-3 text-emerald-500 ml-auto" />}
                        {cell.status === 'error' && <AlertCircle className="w-3 h-3 text-red-400 ml-auto" />}
                    </div>
                    <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
                        {cell.output.map((line, i) => (
                            <OutputRenderer key={i} line={line} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── OutputRenderer ───────────────────────────────────────────────────────────

function OutputRenderer({ line }: { line: OutputLine }) {
    if (line.type === 'error') {
        return (
            <div className="flex items-start gap-2 text-red-400 text-xs font-mono">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{line.content}</span>
            </div>
        );
    }
    if (line.type === 'table') {
        try {
            const data = JSON.parse(line.content);
            const isArray = Array.isArray(data);
            if (isArray && data.length > 0 && typeof data[0] === 'object') {
                const cols = Object.keys(data[0]);
                return (
                    <div className="overflow-x-auto">
                        <table className="text-xs text-slate-300 border-collapse w-full">
                            <thead>
                                <tr>
                                    {cols.map(c => (
                                        <th key={c} className="text-left px-2 py-1 bg-[#21262d] border border-[#30363d] font-semibold text-violet-300">{c}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.slice(0, 100).map((row: Record<string, unknown>, i: number) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-[#0d1117]' : 'bg-[#161b22]'}>
                                        {cols.map(c => (
                                            <td key={c} className="px-2 py-1 border border-[#21262d] font-mono">{String(row[c] ?? '')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            return <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
        } catch {
            return <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{line.content}</pre>;
        }
    }
    return <p className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{line.content}</p>;
}

// ─── CopilotPanel ─────────────────────────────────────────────────────────────

interface CopilotPanelProps {
    prompt: string;
    onPromptChange: (v: string) => void;
    onGenerate: () => void;
    loading: boolean;
    result: string | null;
    error: string | null;
    onInsert: () => void;
    onDiscard: () => void;
}

function CopilotPanel({ prompt, onPromptChange, onGenerate, loading, result, error, onInsert, onDiscard }: CopilotPanelProps) {
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363d]">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-200">ALQUID Copilot</p>
                    <p className="text-[10px] text-slate-500">Genera código para tu notebook</p>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Prompt */}
                {!result && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                            Describe qué quieres calcular
                        </label>
                        <textarea
                            value={prompt}
                            onChange={e => onPromptChange(e.target.value)}
                            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onGenerate(); }}
                            placeholder="Ej: Crea un escenario de stress con bajada del PIB del 2%, paro al 12% y subida de 150bp en toda la curva..."
                            className="w-full h-28 px-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-xl text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                            aria-label="Copilot prompt for code generation"
                        />

                        {error && (
                            <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        <button
                            onClick={onGenerate}
                            disabled={!prompt.trim() || loading}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <><Sparkles className="w-4 h-4" /> Generar Código</>}
                        </button>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            Código generado — revísalo antes de insertar
                        </div>
                        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-[#21262d]">
                                <span className="text-[10px] text-slate-500 font-mono uppercase">preview</span>
                                <Code2 className="w-3 h-3 text-slate-500" />
                            </div>
                            <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-64">
                                {result}
                            </pre>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={onDiscard}
                                className="flex-1 py-2 text-xs text-slate-400 hover:text-slate-200 border border-[#30363d] hover:border-slate-500 rounded-lg transition-colors"
                            >
                                Descartar
                            </button>
                            <button
                                onClick={onInsert}
                                className="flex-1 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Insertar celda
                            </button>
                        </div>
                    </div>
                )}

                {/* Tips */}
                {!result && !loading && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Sugerencias</p>
                        {[
                            'Simula un escenario de recesión severa',
                            'Aplica un shock de tipos paralelo +200bp',
                            'Lee datos de loadData("mi_csv") y calcula la media',
                            'Crea 3 escenarios alternativos comparando diferentes curvas',
                        ].map(tip => (
                            <button
                                key={tip}
                                onClick={() => onPromptChange(tip)}
                                className="w-full text-left px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-indigo-500 transition-colors"
                            >
                                {tip}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

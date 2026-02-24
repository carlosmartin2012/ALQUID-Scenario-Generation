import { useState, useRef, useCallback, useEffect, MutableRefObject, ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { GoogleGenAI } from '@google/genai';
import {
    Play, Plus, Trash2, Sparkles, X, Loader2, ChevronDown,
    Code2, Upload, Link, Database, Terminal, Check,
    RefreshCw, Globe, AlertCircle, DownloadCloud, ChevronUp, LayoutTemplate
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BuiltScenario {
    name: string;
    base_date: string;
    scenarioTypeId: string;
    scenarioTypeLabel: string;
    params: Record<string, unknown>;
    notebookCode: string;   // concatenated source of all code cells
}

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

// ─── Scenario type definitions ────────────────────────────────────────────────

interface ScenarioType {
    id: string;
    label: string;
    description: string;
    color: string;         // tailwind bg colour for badge
    textColor: string;     // tailwind text colour for badge
    starterCode: string;
}

const SCENARIO_TYPES: ScenarioType[] = [
    {
        id: 'irrbb',
        label: 'IRRBB',
        description: 'Interest Rate Risk in the Banking Book',
        color: 'bg-blue-100',
        textColor: 'text-blue-700',
        starterCode: `# IRRBB — Interest Rate Risk in the Banking Book
# ─────────────────────────────────────────────
scenario.name = "IRRBB Q1 2026 — Parallel Shift +200bp"
scenario.base_date = "2026-01-31"

rates = {
    "curve_type": "parallel_shift",
    "shift_bp": 200,
    "shocks": [
        {"term": "1M",  "value": 50},
        {"term": "3M",  "value": 100},
        {"term": "6M",  "value": 150},
        {"term": "1Y",  "value": 200},
        {"term": "2Y",  "value": 200},
        {"term": "5Y",  "value": 200},
        {"term": "10Y", "value": 175},
        {"term": "20Y", "value": 150},
        {"term": "30Y", "value": 125},
    ]
}

macro = {
    "gdp_growth": -0.3,
    "unemployment_rate": 8.1,
    "cpi": 4.5,
}

scenario.set("rates", rates)
scenario.set("macro", macro)

print("✅ IRRBB scenario configured: " + scenario.name)
table(scenario.summary())
`,
    },
    {
        id: 'liquidity',
        label: 'Liquidez',
        description: 'Riesgo de Liquidez – LCR / NSFR',
        color: 'bg-cyan-100',
        textColor: 'text-cyan-700',
        starterCode: `# Liquidez — Liquidity Risk Scenario
# ──────────────────────────────────────
scenario.name = "Liquidity Stress Q1 2026"
scenario.base_date = "2026-01-31"

outflows = {
    "retail_deposits_run_off": 0.10,     # 10% run-off
    "wholesale_funding_run_off": 0.25,   # 25% run-off
    "contingent_liabilities_pct": 0.05,
}

inflows = {
    "performing_loans_inflow_pct": 0.50,
    "secured_lending_inflow_pct": 0.00,
}

hqla = {
    "level1_assets_eur_mm": 500,
    "level2a_assets_eur_mm": 200,
    "level2b_assets_eur_mm": 50,
    "haircuts": {"level2a": 0.15, "level2b": 0.50},
}

scenario.set("outflows", outflows)
scenario.set("inflows", inflows)
scenario.set("hqla", hqla)

net_outflow = hqla["level1_assets_eur_mm"] + hqla["level2a_assets_eur_mm"] * (1 - hqla["haircuts"]["level2a"])
print("📊 Net HQLA after haircuts: " + str(net_outflow) + " € MM")
print("✅ Liquidity scenario configured: " + scenario.name)
table(scenario.summary())
`,
    },
    {
        id: 'fx',
        label: 'FX',
        description: 'Riesgo de Tipo de Cambio',
        color: 'bg-amber-100',
        textColor: 'text-amber-700',
        starterCode: `# FX — Foreign Exchange Risk Scenario
# ─────────────────────────────────────
scenario.name = "FX Stress Q1 2026 — USD/EUR shock"
scenario.base_date = "2026-01-31"

fx_shocks = {
    "EUR_USD": -0.15,   # -15% USD/EUR depreciation
    "EUR_GBP": -0.08,
    "EUR_CHF":  0.10,   # CHF appreciation (safe haven)
    "EUR_JPY": -0.12,
}

fx_positions = {
    "USD_net_position_eur_mm": 120,
    "GBP_net_position_eur_mm":  45,
    "CHF_net_position_eur_mm": -30,
    "JPY_net_position_eur_mm":  20,
}

scenario.set("fx_shocks", fx_shocks)
scenario.set("fx_positions", fx_positions)

pnl_impact = 0
for currency in ["USD", "GBP", "CHF", "JPY"]:
    shock = fx_shocks["EUR_" + currency]
    pos   = fx_positions[currency + "_net_position_eur_mm"]
    impact = pos * shock
    pnl_impact = pnl_impact + impact
    print(currency + " impact: " + str(round(impact, 2)) + " € MM")

print("💰 Total FX P&L impact: " + str(round(pnl_impact, 2)) + " € MM")
table(scenario.summary())
`,
    },
    {
        id: 'csrbb',
        label: 'CSRBB',
        description: 'Credit Spread Risk in the Banking Book',
        color: 'bg-violet-100',
        textColor: 'text-violet-700',
        starterCode: `# CSRBB — Credit Spread Risk in the Banking Book
# ──────────────────────────────────────────────────
scenario.name = "CSRBB Stress Q1 2026 — Spread Widening"
scenario.base_date = "2026-01-31"

credit_spread_shocks = {
    "sovereign_peripheral_bp":  150,  # PIIGS sovereign spread widening
    "IG_corporate_bp":           80,
    "HY_corporate_bp":          250,
    "covered_bonds_bp":          30,
    "ABS_MBS_bp":               120,
}

portfolio = {
    "sovereign_peripheral_eur_mm": 300,
    "IG_corporate_eur_mm":         150,
    "HY_corporate_eur_mm":          40,
    "covered_bonds_eur_mm":        200,
    "ABS_MBS_eur_mm":               80,
}

scenario.set("credit_spread_shocks", credit_spread_shocks)
scenario.set("portfolio", portfolio)

total_impact = 0
segments = ["sovereign_peripheral", "IG_corporate", "HY_corporate", "covered_bonds", "ABS_MBS"]
for seg in segments:
    shock_bp = credit_spread_shocks[seg + "_bp"]
    size_mm  = portfolio[seg + "_eur_mm"]
    # DV01 approx: 1bp = 0.01% of notional * duration (assume 5y avg)
    impact_mm = -(shock_bp / 10000) * size_mm * 5
    total_impact = total_impact + impact_mm
    print(seg + " → " + str(round(impact_mm, 2)) + " € MM")

print("💥 Total CSRBB mark-to-market impact: " + str(round(total_impact, 2)) + " € MM")
table(scenario.summary())
`,
    },
    {
        id: 'macro',
        label: 'Macroeconómico',
        description: 'Escenario Macroeconómico Severo',
        color: 'bg-rose-100',
        textColor: 'text-rose-700',
        starterCode: `# Macroeconómico — Severe Macro Stress
# ───────────────────────────────────────
scenario.name = "Macro Stress Q1 2026 — Recesión Severa"
scenario.base_date = "2026-01-31"

macro = {
    "gdp_growth":          -2.5,   # % annual
    "unemployment_rate":   12.0,   # %
    "cpi":                  1.2,   # % deflation risk
    "house_price_index":  -15.0,   # % YoY
    "equity_index_shock": -35.0,   # % from peak
    "credit_spread_IG_bp": 200,
    "oil_price_usd":        45.0,  # $/barrel
}

rates = {
    "ecb_rate_change_bp": -75,
    "euribor_3m_bp":       -50,
    "curve_type":           "bear_flattener",
    "short_end_shock_bp":  -100,
    "long_end_shock_bp":    -25,
}

scenario.set("macro", macro)
scenario.set("rates", rates)

print("📉 GDP Growth:       " + str(macro["gdp_growth"]) + "%")
print("📉 Unemployment:     " + str(macro["unemployment_rate"]) + "%")
print("📉 House Prices:     " + str(macro["house_price_index"]) + "% YoY")
print("📉 Equity Shock:     " + str(macro["equity_index_shock"]) + "%")
print("✅ Macro scenario configured: " + scenario.name)
table(scenario.summary())
`,
    },
];

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
            .replace(/\bstr\s*\(/g, 'String(')
            .replace(/f"([^"]*)"/g, (_, s) => '`' + s.replace(/\{([^}]+)\}/g, '${$1}') + '`')
            .replace(/for\s+(\w+)\s+in\s+(\w+)\s*:/g, 'for (const $1 of $2)');

    return { print, table, loadData, scenario, transpile };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ScenarioNotebookProps {
    onScenarioBuilt?: (scenario: BuiltScenario) => void;
}

export function ScenarioNotebook({ onScenarioBuilt }: ScenarioNotebookProps = {}) {
    const [scenarioTypeId, setScenarioTypeId] = useState<string>(SCENARIO_TYPES[0].id);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

    const currentType = SCENARIO_TYPES.find(t => t.id === scenarioTypeId) ?? SCENARIO_TYPES[0];

    const [builtScenario, setBuiltScenario] = useState<BuiltScenario | null>(null);

    const [cells, setCells] = useState<Cell[]>(() => [
        { id: uid(), type: 'code', source: currentType.starterCode, output: [], status: 'idle', executionCount: 0 },
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

    // ── When scenario type changes, replace first cell with that type's template ─

    // Called after runAll: collect scenario state and notify parent
    const collectAndExport = (finalCells: Cell[]) => {
        const code = finalCells
            .filter((c: Cell) => c.type === 'code')
            .map((c: Cell) => c.source)
            .join('\n\n// ─────────────────────────────────────────\n\n');
        const snap: BuiltScenario = {
            name: String(scenarioRef.current['name'] ?? currentType.label + ' Scenario'),
            base_date: String(scenarioRef.current['base_date'] ?? new Date().toISOString().split('T')[0]),
            scenarioTypeId: scenarioTypeId,
            scenarioTypeLabel: currentType.label,
            params: { ...(scenarioRef.current['_params'] as Record<string, unknown> ?? {}) },
            notebookCode: code,
        };
        setBuiltScenario(snap);
        onScenarioBuilt?.(snap);
    };

    const handleTypeChange = (typeId: string) => {
        const t = SCENARIO_TYPES.find(s => s.id === typeId);
        if (!t) return;
        setScenarioTypeId(typeId);
        setTypeDropdownOpen(false);
        scenarioRef.current = {};
        setCells([{ id: uid(), type: 'code', source: t.starterCode, output: [], status: 'idle', executionCount: 0 }]);
        setActiveCell(null);
    };

    // ── Cell mutations ──────────────────────────────────────────────────────────

    const addCell = (type: CellType = 'code', afterId?: string) => {
        const newCell: Cell = { id: uid(), type, source: '', output: [], status: 'idle', executionCount: 0 };
        setCells((prev: Cell[]) => {
            if (!afterId) return [...prev, newCell];
            const idx = prev.findIndex((c: Cell) => c.id === afterId);
            return [...prev.slice(0, idx + 1), newCell, ...prev.slice(idx + 1)];
        });
        setActiveCell(newCell.id);
    };

    const updateSource = (id: string, source: string) => {
        setCells((prev: Cell[]) => prev.map((c: Cell) => c.id === id ? { ...c, source } : c));
    };

    const deleteCell = (id: string) => {
        setCells((prev: Cell[]) => prev.filter((c: Cell) => c.id !== id));
    };

    const clearOutput = (id: string) => {
        setCells((prev: Cell[]) => prev.map((c: Cell) => c.id === id ? { ...c, output: [], status: 'idle' } : c));
    };

    // ── Execution ──────────────────────────────────────────────────────────────

    const runCell = useCallback(async (id: string) => {
        const cell = cells.find((c: Cell) => c.id === id);
        if (!cell || cell.type !== 'code') return;

        setCells((prev: Cell[]) => prev.map((c: Cell) => c.id === id ? { ...c, status: 'running', output: [] } : c));

        const output: OutputLine[] = [];
        const { print, table, loadData, scenario, transpile } = buildRuntime(datasets, output, scenarioRef);

        try {
            const js = transpile(cell.source);
            // eslint-disable-next-line no-new-func
            const fn = new Function('print', 'table', 'loadData', 'scenario', js);
            await fn(print, table, loadData, scenario);
            setExecCount((n: number) => n + 1);
            setCells((prev: Cell[]) => prev.map((c: Cell) =>
                c.id === id ? { ...c, status: 'success', output, executionCount: execCount + 1 } : c
            ));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            output.push({ type: 'error', content: msg });
            setCells((prev: Cell[]) => prev.map((c: Cell) =>
                c.id === id ? { ...c, status: 'error', output } : c
            ));
        }
    }, [cells, datasets, execCount]);

    const runAll = async () => {
        setBuiltScenario(null);
        // run cells sequentially and capture updated cells at end
        let latestCells = cells;
        for (const cell of cells) {
            if (cell.type === 'code') {
                await runCell(cell.id);
                // capture latest cells after each run
                latestCells = cells;
            }
        }
        // small delay to let state settle, then export
        setTimeout(() => {
            setCells(prev => {
                collectAndExport(prev);
                return prev;
            });
        }, 100);
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
            setDatasets((prev: Dataset[]) => {
                const exists = prev.findIndex((d: Dataset) => d.name === name);
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
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlInput.trim())}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const rows = parseCSV(text);
            if (rows.length === 0) throw new Error('No se pudo parsear el CSV de la URL.');
            const name = 'url_import_' + Date.now();
            setDatasets((prev: Dataset[]) => [...prev, { name, rows, source: urlInput.trim() }]);
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
            const apiKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error('Gemini API Key no configurada.');
            const ai = new GoogleGenAI({ apiKey });
            const systemPrompt = `Eres un experto en ALM (Asset & Liability Management) y programación.
Tipo de escenario seleccionado: ${currentType.label} — ${currentType.description}

Genera código JavaScript (estilo Python con comentarios #) para el notebook de ALQUID Scenario Generator.

APIs disponibles:
- print(msg)  — muestra texto en el output
- table(obj)  — muestra un objeto/array como tabla
- loadData(name) — carga un dataset importado por su nombre (retorna array de {col: val})
- scenario.name = "..."
- scenario.base_date = "YYYY-MM-DD"
- scenario.set("bloque", { ... })
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
        setCells((prev: Cell[]) => [...prev, newCell]);
        setActiveCell(newCell.id);
        setCopilotResult(null);
        setCopilotPrompt('');
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-slate-50 text-slate-900 font-sans overflow-hidden">

            {/* ── Top Bar ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                            <Code2 className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm tracking-tight">Scenario Notebook</span>
                    </div>

                    {/* ── Scenario Type Dropdown ── */}
                    <div className="relative">
                        <button
                            id="scenario-type-btn"
                            title="Seleccionar tipo de escenario"
                            onClick={() => setTypeDropdownOpen(v => !v)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                                currentType.color, currentType.textColor,
                                "border-current/20 hover:brightness-95"
                            )}
                        >
                            <LayoutTemplate className="w-3.5 h-3.5" />
                            {currentType.label}
                            <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>

                        <AnimatePresence>
                            {typeDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.12 }}
                                    className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
                                >
                                    <div className="px-3 py-2 border-b border-slate-100">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tipo de Escenario</p>
                                    </div>
                                    {SCENARIO_TYPES.map(t => (
                                        <button
                                            key={t.id}
                                            title={t.description}
                                            onClick={() => handleTypeChange(t.id)}
                                            className={cn(
                                                "w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors",
                                                t.id === scenarioTypeId && 'bg-indigo-50'
                                            )}
                                        >
                                            <span className={cn("mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0", t.color, t.textColor)}>
                                                {t.label}
                                            </span>
                                            <span className="text-xs text-slate-600">{t.description}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="h-4 w-px bg-slate-200" />

                    <AnimatePresence>
                        {builtScenario && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                            >
                                <Check className="w-3 h-3" />
                                Ready to Import
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex items-center gap-1">
                        <button
                            title="Añadir celda de código"
                            onClick={() => addCell('code')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Code
                        </button>
                        <button
                            title="Añadir celda de markdown"
                            onClick={() => addCell('markdown')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors border border-slate-200"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Markdown
                        </button>
                        <button
                            title="Ejecutar todas las celdas"
                            onClick={runAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                        >
                            <Play className="w-3.5 h-3.5" />
                            Run All
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {datasets.length > 0 && (
                        <div
                            title="Ver datasets importados"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-violet-100"
                            onClick={() => setImportOpen(true)}
                        >
                            <Database className="w-3.5 h-3.5" />
                            {datasets.length} dataset{datasets.length > 1 ? 's' : ''}
                        </div>
                    )}
                    <button
                        title="Importar datos"
                        onClick={() => setImportOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        Import Data
                    </button>
                    <button
                        title="Abrir / cerrar Copilot"
                        onClick={() => setCopilotOpen(v => !v)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border",
                            copilotOpen
                                ? "bg-indigo-600 text-white border-indigo-500"
                                : "text-slate-600 hover:bg-slate-100 border-slate-200"
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

                        <button
                            title="Añadir celda de código"
                            onClick={() => addCell('code')}
                            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-slate-300 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-all text-sm"
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
                            className="flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden"
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
                                scenarioType={currentType}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Import Modal ── */}
            <AnimatePresence>
                {importOpen && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Database className="w-5 h-5 text-violet-500" />
                                    <span className="font-bold text-slate-900 text-base">Import Data</span>
                                </div>
                                <button title="Cerrar" onClick={() => setImportOpen(false)} className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* File upload */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Upload File</p>
                                    <div
                                        className="border-2 border-dashed border-slate-200 hover:border-violet-400 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="w-8 h-8 text-slate-400" />
                                        <p className="text-sm text-slate-500">Click to upload <span className="text-violet-600 font-medium">.csv</span> or <span className="text-violet-600 font-medium">.txt</span></p>
                                        <p className="text-xs text-slate-400">El dataset estará disponible con <code className="bg-slate-100 px-1 rounded">loadData("nombre")</code></p>
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
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Import from URL</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={urlInput}
                                            onChange={e => setUrlInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleUrlImport()}
                                            placeholder="https://www.bde.es/...csv"
                                            aria-label="URL para importar CSV"
                                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
                                        />
                                        <button
                                            title="Importar desde URL"
                                            onClick={handleUrlImport}
                                            disabled={urlLoading}
                                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                                            Fetch
                                        </button>
                                    </div>
                                    {urlError && (
                                        <div className="mt-2 flex items-center gap-1.5 text-red-500 text-xs">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {urlError}
                                        </div>
                                    )}

                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {OFFICIAL_SOURCES.map(src => (
                                            <a
                                                key={src.label}
                                                href={src.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={src.description}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 hover:border-violet-400 rounded-lg text-xs text-slate-600 hover:text-slate-900 transition-colors"
                                            >
                                                <span>{src.icon}</span>
                                                <span className="font-medium">{src.label}</span>
                                                <Globe className="w-3 h-3 ml-auto opacity-30" />
                                            </a>
                                        ))}
                                    </div>
                                </div>

                                {/* Loaded datasets */}
                                {datasets.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Loaded Datasets</p>
                                        <div className="space-y-1.5">
                                            {datasets.map((ds, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <Database className="w-3.5 h-3.5 text-violet-500" />
                                                        <code className="text-violet-600 font-mono">{ds.name}</code>
                                                        <span className="text-slate-400">({ds.rows.length} rows)</span>
                                                    </div>
                                                    <button
                                                        title="Eliminar dataset"
                                                        onClick={() => setDatasets((prev: Dataset[]) => prev.filter((_, j) => j !== i))}
                                                        className="text-slate-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={() => setImportOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Close type dropdown on outside click */}
            {typeDropdownOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setTypeDropdownOpen(false)} />
            )}
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

    const statusBorder = {
        idle: isActive ? 'border-indigo-300' : 'border-slate-200 hover:border-slate-300',
        running: 'border-amber-400',
        success: 'border-emerald-400',
        error: 'border-red-400',
    }[cell.status] + (cell.status !== 'idle' ? '' : '');

    return (
        <div
            className={cn(
                "group rounded-xl border transition-all duration-150 bg-white shadow-sm",
                cell.status === 'idle' ? statusBorder : {
                    running: 'border-amber-400',
                    success: 'border-emerald-400',
                    error: 'border-red-400',
                }[cell.status]
            )}
            onClick={onActivate}
        >
            {/* Cell header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                <span className="text-xs font-mono text-slate-400 w-6 text-right flex-shrink-0">
                    {cell.type === 'code' ? `[${cell.executionCount > 0 ? cell.executionCount : ' '}]` : 'MD'}
                </span>
                <span className="text-xs text-slate-400 flex-1">{cell.type === 'code' ? 'JavaScript (Python-like)' : 'Markdown'}</span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {cell.type === 'code' && cell.output.length > 0 && (
                        <button title="Limpiar output" onClick={(e) => { e.stopPropagation(); onClearOutput(); }} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    )}
                    <button title="Añadir celda debajo" onClick={(e) => { e.stopPropagation(); onAddAfter('code'); }} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                        <Plus className="w-3 h-3" />
                    </button>
                    <button title="Eliminar celda" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-slate-400 hover:text-red-500 rounded">
                        <Trash2 className="w-3 h-3" />
                    </button>
                    {cell.type === 'code' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRun(); }}
                            disabled={cell.status === 'running'}
                            title="Ejecutar (Ctrl+Enter)"
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
                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col items-end pr-2 pt-3 select-none text-[11px] font-mono text-slate-300 leading-5 border-r border-slate-100">
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
                        cell.type === 'code' ? 'text-indigo-900' : 'text-slate-700 italic'
                    )}
                    style={{ minHeight: '80px' }}
                />
            </div>

            {/* Output */}
            {cell.output.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 rounded-b-xl overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-100">
                        <Terminal className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Output</span>
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
            <div className="flex items-start gap-2 text-red-500 text-xs font-mono">
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
                        <table className="text-xs text-slate-700 border-collapse w-full">
                            <thead>
                                <tr>
                                    {cols.map(c => (
                                        <th key={c} className="text-left px-2 py-1 bg-slate-100 border border-slate-200 font-semibold text-indigo-700">{c}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.slice(0, 100).map((row: Record<string, unknown>, i: number) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        {cols.map(c => (
                                            <td key={c} className="px-2 py-1 border border-slate-100 font-mono">{String(row[c] ?? '')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            return <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
        } catch {
            return <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{line.content}</pre>;
        }
    }
    return <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{line.content}</p>;
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
    scenarioType: ScenarioType;
}

function CopilotPanel({ prompt, onPromptChange, onGenerate, loading, result, error, onInsert, onDiscard, scenarioType }: CopilotPanelProps) {
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-800">AI Copilot</p>
                    <p className="text-[10px] text-slate-400">Contexto: <span className={cn("font-semibold", scenarioType.textColor)}>{scenarioType.label}</span></p>
                </div>
            </div>

            {/* Prompt */}
            <div className="p-4 border-b border-slate-100">
                <textarea
                    value={prompt}
                    onChange={e => onPromptChange(e.target.value)}
                    onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onGenerate(); }}
                    placeholder={`Describe el escenario ${scenarioType.label} que quieres generar…`}
                    aria-label="Prompt para el copilot de escenarios"
                    rows={4}
                    className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-indigo-400 placeholder:text-slate-400"
                />
                <button
                    title="Generar código con IA (Ctrl+Enter)"
                    onClick={onGenerate}
                    disabled={loading || !prompt.trim()}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {loading ? 'Generando…' : 'Generate Code'}
                </button>
            </div>

            {/* Result */}
            <div className="flex-1 overflow-y-auto p-4">
                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}
                {result && (
                    <div>
                        <pre className="text-xs font-mono text-indigo-900 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto">{result}</pre>
                        <div className="flex gap-2 mt-3">
                            <button
                                title="Insertar código en nueva celda"
                                onClick={onInsert}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Insertar celda
                            </button>
                            <button
                                title="Descartar código generado"
                                onClick={onDiscard}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
                {!result && !error && !loading && (
                    <div className="text-center text-slate-400 text-xs py-8">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Describe el escenario que necesitas<br />y el copilot generará el código.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Silence unused import warnings for icons used indirectly
void ChevronUp; void Link;

import { useState, useEffect, MouseEvent, useRef, ChangeEvent } from 'react';
import {
  LayoutDashboard,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  FileText,
  Trash2,
  Upload,
  Copy,
  ShieldAlert,
  Settings,
  FileSpreadsheet,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScenarioBuilder } from './components/ScenarioBuilder';
import { useScenarios } from './hooks/useScenarios';
import { cn } from './lib/utils';
import { RiskType, Scenario } from './types';
import { Login } from './components/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { scenarios, loading, createScenario, deleteScenario, copyScenariosFromDate } = useScenarios();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNewDateModalOpen, setIsNewDateModalOpen] = useState(false);

  // Create Scenario State
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');
  const [newScenarioDate, setNewScenarioDate] = useState(new Date().toISOString().split('T')[0]);
  const [newScenarioRiskTypes, setNewScenarioRiskTypes] = useState<RiskType[]>(['IRRBB']);

  // New Date / Copy State
  const [newDateValue, setNewDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [copySourceDate, setCopySourceDate] = useState('');

  // File Upload / Connection State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMethod, setImportMethod] = useState<'file' | 'alquid'>('file');
  const [isAlquidConnected, setIsAlquidConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedClosingDate, setSelectedClosingDate] = useState('');

  const riskOptions: RiskType[] = ['IRRBB', 'CSRBB', 'Liquidity', 'FX', 'Macroeconomic'];

  const handleCreate = async () => {
    if (!newScenarioName) return;

    // If file is selected, we would upload it here. 
    // For now, we'll just create the scenario and log the file.
    if (importMethod === 'file' && selectedFile) {
      console.log("File to upload:", selectedFile.name);
      // TODO: Implement actual file upload logic
    } else if (importMethod === 'alquid' && selectedClosingDate) {
      console.log("Importing from ALQUID closing date:", selectedClosingDate);
      // TODO: Implement ALQUID import logic
    }

    try {
      const id = await createScenario(newScenarioName, newScenarioDesc, newScenarioDate, newScenarioRiskTypes);
      setSelectedScenarioId(id);
      setIsCreateModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("Failed to create scenario:", err);
      const details = err.message || "Unknown error";
      alert(`Failed to create scenario.\n\nDetails: ${details}\n\nPlease check the console for more information.`);
    }
  };

  const handleConnectAlquid = () => {
    setIsConnecting(true);
    // Simulate connection delay
    setTimeout(() => {
      setIsConnecting(false);
      setIsAlquidConnected(true);
    }, 1500);
  };

  const handleCopyDate = async () => {
    try {
      if (copySourceDate) {
        await copyScenariosFromDate(copySourceDate, newDateValue);
      } else {
        // If no source date, create a default "Baseline" scenario for the new date
        // so that the date appears in the UI
        await createScenario("Baseline", "Initial baseline for " + newDateValue, newDateValue, ['IRRBB']);
      }
      setIsNewDateModalOpen(false);
      setCopySourceDate('');
    } catch (err) {
      console.error("Failed to handle date creation:", err);
      alert("Error processing date. Check connection.");
    }
  };

  const resetForm = () => {
    setNewScenarioName('');
    setNewScenarioDesc('');
    setNewScenarioDate(new Date().toISOString().split('T')[0]);
    setNewScenarioRiskTypes(['IRRBB']);
    setSelectedFile(null);
    setImportMethod('file');
    setIsAlquidConnected(false);
    setSelectedClosingDate('');
  };

  const toggleRiskType = (type: RiskType) => {
    setNewScenarioRiskTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDelete = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this scenario?')) {
      try {
        await deleteScenario(id);
        if (selectedScenarioId === id) {
          setSelectedScenarioId(null);
        }
      } catch (error) {
        console.error("Failed to delete scenario:", error);
        alert("Failed to delete scenario");
      }
    }
  };

  // Get unique dates for copy source dropdown
  const uniqueDates = Array.from(new Set(scenarios.map(s => s.base_date))).sort().reverse();



  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm p-0.5 bg-white">
              <img src="/logo.jpg" alt="N" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight">ALQUID</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <button
              onClick={() => setSelectedScenarioId(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                !selectedScenarioId
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setIsNewDateModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              + New Date
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Scenario
            </button>
          </div>

          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-400">Loading...</div>
          ) : (
            Object.entries(
              (scenarios || []).reduce((acc, s) => {
                if (!s) return acc;
                let date: Date;
                try {
                  if (s.base_date && typeof s.base_date === 'string') {
                    const parts = s.base_date.split('-');
                    if (parts.length === 3) {
                      const [year, month, day] = parts.map(Number);
                      date = new Date(year, month - 1, day);
                    } else {
                      date = new Date(s.created_at || Date.now());
                    }
                  } else {
                    date = new Date(s.created_at || Date.now());
                  }

                  if (isNaN(date.getTime())) {
                    date = new Date();
                  }
                } catch (e) {
                  date = new Date();
                }

                const key = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
                const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                if (!acc[sortKey]) {
                  acc[sortKey] = { label: key, scenarios: [] };
                }
                acc[sortKey].scenarios.push(s);
                return acc;
              }, {} as Record<string, { label: string; scenarios: Scenario[] }>)
            )
              .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
              .map(([sortKey, group]: [string, { label: string; scenarios: Scenario[] }]) => (
                <div key={sortKey}>
                  <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {group.label}
                  </div>
                  <div className="space-y-1">
                    {group.scenarios.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedScenarioId(s.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          selectedScenarioId === s.id
                            ? "bg-indigo-50 text-indigo-700 font-medium"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <FileSpreadsheet className="w-4 h-4 opacity-70" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {selectedScenarioId ? (
          <ScenarioBuilder scenarioId={selectedScenarioId} onBack={() => setSelectedScenarioId(null)} />
        ) : (
          <div className="flex-1 p-8 overflow-y-auto">
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-slate-500 mt-1">Manage your ALM scenarios and simulations.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search scenarios..."
                    className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                  />
                </div>
                <button
                  title="Filter scenarios"
                  aria-label="Filter scenarios"
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-500">Total Scenarios</h3>
                  <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{scenarios.length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-500">Validated</h3>
                  <ShieldAlert className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {scenarios.filter(s => s.status === 'validated').length}
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-500">Drafts</h3>
                  <Settings className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {scenarios.filter(s => s.status === 'draft').length}
                </div>
              </div>
            </div>

            {/* Recent Scenarios Table */}
            <div className="space-y-8">
              {Object.entries(
                (scenarios || []).reduce((acc, s) => {
                  if (!s) return acc;
                  let date: Date;
                  try {
                    if (s.base_date && typeof s.base_date === 'string') {
                      const parts = s.base_date.split('-');
                      if (parts.length === 3) {
                        const [year, month, day] = parts.map(Number);
                        date = new Date(year, month - 1, day);
                      } else {
                        date = new Date(s.created_at || Date.now());
                      }
                    } else {
                      date = new Date(s.created_at || Date.now());
                    }

                    if (isNaN(date.getTime())) {
                      date = new Date();
                    }
                  } catch (e) {
                    date = new Date();
                  }

                  const key = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
                  const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                  if (!acc[sortKey]) {
                    acc[sortKey] = { label: key, scenarios: [] };
                  }
                  acc[sortKey].scenarios.push(s);
                  return acc;
                }, {} as Record<string, { label: string; scenarios: Scenario[] }>)
              )
                .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
                .map(([sortKey, group]: [string, { label: string; scenarios: Scenario[] }]) => (
                  <div key={sortKey} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <h2 className="font-semibold text-slate-900 capitalize">{group.label}</h2>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                        {group.scenarios.length} scenarios
                      </span>
                    </div>
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                          <th className="px-6 py-3">Name</th>
                          <th className="px-6 py-3">Risk Types</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Last Modified</th>
                          <th className="px-6 py-3">Base Date</th>
                          <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.scenarios.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedScenarioId(s.id)}>
                            <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {(s.risk_types || ['IRRBB']).map((rt: string) => (
                                  <span key={rt} className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                    {rt}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                s.status === 'validated' ? "bg-emerald-100 text-emerald-700" :
                                  s.status === 'archived' ? "bg-slate-100 text-slate-700" :
                                    "bg-amber-100 text-amber-700"
                              )}>
                                {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {new Date(s.updated_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-slate-500">{s.base_date}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedScenarioId(s.id);
                                  }}
                                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  title="Delete scenario"
                                  aria-label="Delete scenario"
                                  onClick={(e) => handleDelete(e, s.id)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

              {scenarios.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
                  No scenarios found. Create one to get started.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">Create New Scenario</h2>
                <button
                  title="Close modal"
                  aria-label="Close modal"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Scenario Name</label>
                  <input
                    type="text"
                    value={newScenarioName}
                    onChange={(e) => setNewScenarioName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Q4 Stress Test"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={newScenarioDesc}
                    onChange={(e) => setNewScenarioDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    rows={3}
                    placeholder="Describe the scenario assumptions..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Base Date</label>
                    <input
                      title="Base Date"
                      aria-label="Base Date"
                      type="date"
                      value={newScenarioDate}
                      onChange={(e) => setNewScenarioDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Risk Types</label>
                  <div className="flex flex-wrap gap-2">
                    {riskOptions.map(risk => (
                      <button
                        key={risk}
                        onClick={() => toggleRiskType(risk)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                          newScenarioRiskTypes.includes(risk)
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {risk}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Import Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Import Data Source</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                    <button
                      onClick={() => setImportMethod('file')}
                      className={cn(
                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                        importMethod === 'file'
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      File Upload
                    </button>
                    <button
                      onClick={() => setImportMethod('alquid')}
                      className={cn(
                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                        importMethod === 'alquid'
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      ALQUID Connection
                    </button>
                  </div>

                  {importMethod === 'file' ? (
                    <div
                      className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        title="Upload scenario file"
                        aria-label="Upload scenario file"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".xlsx,.xls,.csv,.json"
                      />
                      {selectedFile ? (
                        <div className="flex items-center gap-2 text-indigo-600 font-medium">
                          <FileText className="w-5 h-5" />
                          {selectedFile.name}
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-sm text-slate-600 font-medium">Click to upload or drag and drop</p>
                          <p className="text-xs text-slate-400 mt-1">.xlsx, .csv, or .json files</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                      {!isAlquidConnected ? (
                        <div className="text-center">
                          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Activity className="w-6 h-6 text-indigo-600" />
                          </div>
                          <h3 className="text-sm font-medium text-slate-900 mb-1">Connect to ALQUID Environment</h3>
                          <p className="text-xs text-slate-500 mb-4">Securely fetch data directly from your production environment.</p>
                          <button
                            onClick={handleConnectAlquid}
                            disabled={isConnecting}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex items-center gap-2 mx-auto"
                          >
                            {isConnecting ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>Connect Environment</>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg text-sm font-medium border border-emerald-100">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            Connected to ALQUID Production
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Select Closing</label>
                            <select
                              title="Closing Date"
                              aria-label="Select closing date"
                              value={selectedClosingDate}
                              onChange={(e) => setSelectedClosingDate(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                              <option value="">-- Select a closing --</option>
                              <option value="CeR Septiembre 2025">CeR Septiembre 2025</option>
                              <option value="CeR Octubre 2025">CeR Octubre 2025</option>
                              <option value="MeR Enero 2026">MeR Enero 2026</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newScenarioName}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Scenario
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Date / Copy Modal */}
      <AnimatePresence>
        {isNewDateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">New Reporting Date</h2>
                <button
                  title="Close modal"
                  aria-label="Close modal"
                  onClick={() => setIsNewDateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Date</label>
                  <input
                    title="New Date"
                    aria-label="New Date"
                    type="date"
                    value={newDateValue}
                    onChange={(e) => setNewDateValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2 mb-3 text-indigo-800 font-medium">
                    <Copy className="w-4 h-4" />
                    Copy Scenarios From
                  </div>
                  <p className="text-xs text-indigo-600 mb-3">
                    Optionally copy all scenarios from a previous date to the new date.
                  </p>
                  <select
                    title="Copy Source Date"
                    aria-label="Select source date for copy"
                    value={copySourceDate}
                    onChange={(e) => setCopySourceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                  >
                    <option value="">-- Do not copy (Start fresh) --</option>
                    {uniqueDates.map(date => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setIsNewDateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCopyDate}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create Date
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;

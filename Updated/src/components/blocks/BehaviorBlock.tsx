import { BehaviorParams, NMDModel, PrepaymentModel } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BehaviorBlockProps {
  data?: BehaviorParams;
  onChange: (data: BehaviorParams) => void;
}

const DEFAULT_NMD_MODELS: NMDModel[] = [
  {
    id: '1',
    name: 'Minorista Transaccional',
    beta: 0.5,
    volatile_pct: 20,
    semistable_matrix: [
      { rate: 0, depo_pct: 100 },
      { rate: 2, depo_pct: 90 },
      { rate: 5, depo_pct: 70 },
    ]
  },
  {
    id: '2',
    name: 'Minorista No Transaccional',
    beta: 0.7,
    volatile_pct: 30,
    semistable_matrix: [
      { rate: 0, depo_pct: 100 },
      { rate: 2, depo_pct: 80 },
      { rate: 5, depo_pct: 50 },
    ]
  }
];

const DEFAULT_PREPAYMENT_MODELS: PrepaymentModel[] = [
  {
    id: '1',
    name: 'Consumo',
    type: 'CPR',
    speed_multiplier: 1.0,
    cmpp: 5,
    tpt: 12
  },
  {
    id: '2',
    name: 'Hipotecario',
    type: 'SMM',
    speed_multiplier: 1.0,
    cmpp: 2,
    tpt: 60
  }
];

export function BehaviorBlock({ data, onChange }: BehaviorBlockProps) {
  const nmdModels = data?.nmd_models || DEFAULT_NMD_MODELS;
  const prepaymentModels = data?.prepayment_models || DEFAULT_PREPAYMENT_MODELS;

  const updateNMDModel = (index: number, field: keyof NMDModel, value: any) => {
    const newModels = [...nmdModels];
    newModels[index] = { ...newModels[index], [field]: value };
    onChange({ ...data, nmd_models: newModels } as BehaviorParams);
  };

  const updateNMDMatrix = (modelIndex: number, rowIndex: number, field: 'rate' | 'depo_pct', value: number) => {
    const newModels = [...nmdModels];
    const newMatrix = [...newModels[modelIndex].semistable_matrix];
    newMatrix[rowIndex] = { ...newMatrix[rowIndex], [field]: value };
    newModels[modelIndex] = { ...newModels[modelIndex], semistable_matrix: newMatrix };
    onChange({ ...data, nmd_models: newModels } as BehaviorParams);
  };

  const addNMDMatrixRow = (modelIndex: number) => {
    const newModels = [...nmdModels];
    const newMatrix = [...newModels[modelIndex].semistable_matrix, { rate: 0, depo_pct: 0 }];
    newModels[modelIndex] = { ...newModels[modelIndex], semistable_matrix: newMatrix };
    onChange({ ...data, nmd_models: newModels } as BehaviorParams);
  };
  
  const removeNMDMatrixRow = (modelIndex: number, rowIndex: number) => {
    const newModels = [...nmdModels];
    const newMatrix = [...newModels[modelIndex].semistable_matrix];
    newMatrix.splice(rowIndex, 1);
    newModels[modelIndex] = { ...newModels[modelIndex], semistable_matrix: newMatrix };
    onChange({ ...data, nmd_models: newModels } as BehaviorParams);
  };

  const updatePrepaymentModel = (index: number, field: keyof PrepaymentModel, value: any) => {
    const newModels = [...prepaymentModels];
    newModels[index] = { ...newModels[index], [field]: value };
    onChange({ ...data, prepayment_models: newModels } as BehaviorParams);
  };

  return (
    <div className="space-y-8">
      {/* NMDs Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">Non-Maturity Deposits (NMDs)</h3>
        
        {nmdModels.map((model, idx) => (
          <div key={model.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-800 mb-4">{model.name}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Beta</label>
                <input
                  type="number"
                  step="0.01"
                  value={model.beta ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateNMDModel(idx, 'beta', isNaN(val) ? 0 : val);
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">% Volatile</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={model.volatile_pct ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateNMDModel(idx, 'volatile_pct', isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="absolute right-4 top-2.5 text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Semistable Matrix</span>
                <button 
                  onClick={() => addNMDMatrixRow(idx)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Row
                </button>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-4 py-2">% Rates</th>
                    <th className="px-4 py-2">% Depos</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {model.semistable_matrix.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.rate ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateNMDMatrix(idx, rIdx, 'rate', isNaN(val) ? 0 : val);
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.depo_pct ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateNMDMatrix(idx, rIdx, 'depo_pct', isNaN(val) ? 0 : val);
                          }}
                          className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button 
                          onClick={() => removeNMDMatrixRow(idx, rIdx)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Prepayments Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2">Prepayments</h3>
        
        {prepaymentModels.map((model, idx) => (
          <div key={model.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-lg font-semibold text-slate-800">{model.name}</h4>
              <span className={cn(
                "px-2 py-1 rounded text-xs font-bold uppercase",
                model.type === 'CPR' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
              )}>
                {model.type}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {model.type === 'CPR' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Speed Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={model.speed_multiplier ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updatePrepaymentModel(idx, 'speed_multiplier', isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
              
              {model.type === 'SMM' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">CMPP</label>
                    <input
                      type="number"
                      step="0.1"
                      value={model.cmpp ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updatePrepaymentModel(idx, 'cmpp', isNaN(val) ? 0 : val);
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">TPT</label>
                    <input
                      type="number"
                      step="1"
                      value={model.tpt ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updatePrepaymentModel(idx, 'tpt', isNaN(val) ? 0 : val);
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

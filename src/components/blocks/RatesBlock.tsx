import { RatesParams } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface RatesBlockProps {
  data?: RatesParams;
  onChange: (data: RatesParams) => void;
}

export function RatesBlock({ data, onChange }: RatesBlockProps) {
  const handleChange = (field: keyof RatesParams, value: any) => {
    onChange({
      ...data,
      [field]: value
    } as RatesParams);
  };

  const addShock = () => {
    const newShocks = [...(data?.shocks || []), { term: '1Y', value: 0 }];
    handleChange('shocks', newShocks);
  };

  const removeShock = (index: number) => {
    const newShocks = [...(data?.shocks || [])];
    newShocks.splice(index, 1);
    handleChange('shocks', newShocks);
  };

  const updateShock = (index: number, field: 'term' | 'value', value: string | number) => {
    const newShocks = [...(data?.shocks || [])];
    newShocks[index] = { ...newShocks[index], [field]: value };
    handleChange('shocks', newShocks);
  };

  return (
    <div className="space-y-8">
      {/* Curve Type Selection */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Curve Transformation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Scenario Type</label>
            <select
              title="Scenario Type"
              aria-label="Scenario Type"
              value={data?.curve_type || 'base'}
              onChange={(e) => handleChange('curve_type', e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
            >
              <option value="base">Base (No Change)</option>
              <option value="parallel_shift">Parallel Shift</option>
              <option value="steepener">Steepener</option>
              <option value="flattener">Flattener</option>
              <option value="custom">Custom Shocks</option>
            </select>
          </div>

          {data?.curve_type === 'parallel_shift' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Shift Magnitude (bp)</label>
              <div className="relative">
                <input
                  title="Shift Magnitude"
                  aria-label="Shift magnitude in basis points"
                  type="number"
                  value={data?.shift_bp || 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    handleChange('shift_bp', isNaN(val) ? 0 : val);
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <span className="absolute right-4 top-2.5 text-slate-400 text-sm">bp</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Shocks Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Term Structure Shocks</h3>
          <button
            title="Add shock point"
            aria-label="Add shock point"
            onClick={addShock}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Point
          </button>
        </div>

        {(!data?.shocks || data.shocks.length === 0) ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No specific term shocks defined.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3 w-1/3">Term</th>
                  <th className="px-4 py-3 w-1/3">Shock (bp)</th>
                  <th className="px-4 py-3 w-1/3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.shocks.map((shock, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <select
                        title="Shock Term"
                        aria-label="Select term for custom shock"
                        value={shock.term}
                        onChange={(e) => updateShock(idx, 'term', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                      >
                        {['ON', '1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        title="Shock Value (bp)"
                        aria-label="Shock magnitude in basis points"
                        type="number"
                        value={shock.value}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateShock(idx, 'value', isNaN(val) ? 0 : val);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        title="Remove shock point"
                        aria-label="Remove shock point"
                        onClick={() => removeShock(idx)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

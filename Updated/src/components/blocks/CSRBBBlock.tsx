import { useState } from 'react';
import { CSRBBParams } from '../../types';
import { ShieldAlert, Plus, Trash2 } from 'lucide-react';

interface CSRBBBlockProps {
  data?: CSRBBParams;
  onChange: (data: CSRBBParams) => void;
}

export function CSRBBBlock({ data, onChange }: CSRBBBlockProps) {
  const params = data || {
    spread_shocks: []
  };

  const addShock = () => {
    onChange({
      ...params,
      spread_shocks: [
        ...(params.spread_shocks || []),
        { sector: 'Corporate', rating: 'BBB', shock_bp: 50 }
      ]
    });
  };

  const removeShock = (index: number) => {
    const newShocks = [...(params.spread_shocks || [])];
    newShocks.splice(index, 1);
    onChange({
      ...params,
      spread_shocks: newShocks
    });
  };

  const updateShock = (index: number, field: keyof typeof params.spread_shocks[0], value: any) => {
    const newShocks = [...(params.spread_shocks || [])];
    newShocks[index] = { ...newShocks[index], [field]: value };
    onChange({
      ...params,
      spread_shocks: newShocks
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Credit Spread Shocks</h3>
          </div>
          <button
            onClick={addShock}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Shock
          </button>
        </div>

        {(!params.spread_shocks || params.spread_shocks.length === 0) ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No credit spread shocks defined. Add one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {params.spread_shocks.map((shock, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sector</label>
                  <input
                    type="text"
                    value={shock.sector}
                    onChange={(e) => updateShock(index, 'sector', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Rating</label>
                  <select
                    value={shock.rating}
                    onChange={(e) => updateShock(index, 'rating', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="AAA">AAA</option>
                    <option value="AA">AA</option>
                    <option value="A">A</option>
                    <option value="BBB">BBB</option>
                    <option value="BB">BB</option>
                    <option value="B">B</option>
                    <option value="CCC">CCC</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Shock (bp)</label>
                  <input
                    type="number"
                    value={shock.shock_bp}
                    onChange={(e) => updateShock(index, 'shock_bp', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={() => removeShock(index)}
                  className="mt-5 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

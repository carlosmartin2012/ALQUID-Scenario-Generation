import { useState } from 'react';
import { FXParams } from '../../types';
import { ArrowRightLeft, Plus, Trash2 } from 'lucide-react';

interface FXBlockProps {
  data?: FXParams;
  onChange: (data: FXParams) => void;
}

export function FXBlock({ data, onChange }: FXBlockProps) {
  const params = data || {
    shocks: []
  };

  const addShock = () => {
    onChange({
      ...params,
      shocks: [
        ...(params.shocks || []),
        { currency_pair: 'USD/COP', shock_pct: 10 }
      ]
    });
  };

  const removeShock = (index: number) => {
    const newShocks = [...(params.shocks || [])];
    newShocks.splice(index, 1);
    onChange({
      ...params,
      shocks: newShocks
    });
  };

  const updateShock = (index: number, field: keyof typeof params.shocks[0], value: any) => {
    const newShocks = [...(params.shocks || [])];
    newShocks[index] = { ...newShocks[index], [field]: value };
    onChange({
      ...params,
      shocks: newShocks
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">FX Shocks</h3>
          </div>
          <button
            onClick={addShock}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Shock
          </button>
        </div>

        {(!params.shocks || params.shocks.length === 0) ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No FX shocks defined. Add one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {params.shocks.map((shock, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Currency Pair</label>
                  <input
                    type="text"
                    value={shock.currency_pair}
                    onChange={(e) => updateShock(index, 'currency_pair', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. USD/COP"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Shock (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={shock.shock_pct}
                    onChange={(e) => updateShock(index, 'shock_pct', parseFloat(e.target.value) || 0)}
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

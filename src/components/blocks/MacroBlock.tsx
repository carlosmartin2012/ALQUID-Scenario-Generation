import { useState } from 'react';
import { MacroParams } from '../../types';
import { TrendingUp } from 'lucide-react';

interface MacroBlockProps {
  data?: MacroParams;
  onChange: (data: MacroParams) => void;
}

export function MacroBlock({ data, onChange }: MacroBlockProps) {
  const params = data || {
    gdp_growth: 0,
    unemployment_rate: 0,
    cpi: 0,
    house_price_index: 0
  };

  const handleChange = (field: keyof MacroParams, value: number) => {
    onChange({
      ...params,
      [field]: value
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Macroeconomic Indicators</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              GDP Growth (%)
            </label>
            <input
              title="GDP Growth"
              aria-label="Annual GDP growth rate shock"
              type="number"
              step="0.1"
              value={params.gdp_growth}
              onChange={(e) => handleChange('gdp_growth', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">Annual GDP growth rate shock</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unemployment Rate (%)
            </label>
            <input
              title="Unemployment Rate"
              aria-label="Unemployment rate shock"
              type="number"
              step="0.1"
              value={params.unemployment_rate}
              onChange={(e) => handleChange('unemployment_rate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">Unemployment rate shock</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              CPI (%)
            </label>
            <input
              title="CPI shock"
              aria-label="Consumer Price Index shock"
              type="number"
              step="0.1"
              value={params.cpi}
              onChange={(e) => handleChange('cpi', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">Consumer Price Index shock</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              House Price Index (%)
            </label>
            <input
              title="House Price Index shock"
              aria-label="HPI shock"
              type="number"
              step="0.1"
              value={params.house_price_index}
              onChange={(e) => handleChange('house_price_index', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">HPI shock</p>
          </div>
        </div>
      </div>
    </div>
  );
}

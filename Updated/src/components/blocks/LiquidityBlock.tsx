import { useState } from 'react';
import { LiquidityParams } from '../../types';
import { Droplets } from 'lucide-react';

interface LiquidityBlockProps {
  data?: LiquidityParams;
  onChange: (data: LiquidityParams) => void;
}

export function LiquidityBlock({ data, onChange }: LiquidityBlockProps) {
  const params = data || {
    lcr_haircut: 0,
    nsfr_haircut: 0,
    deposit_runoff_scalar: 1.0
  };

  const handleChange = (field: keyof LiquidityParams, value: number) => {
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
            <Droplets className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Liquidity Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              LCR Haircut (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={params.lcr_haircut}
              onChange={(e) => handleChange('lcr_haircut', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">Additional haircut on HQLA for LCR</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              NSFR Haircut (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={params.nsfr_haircut}
              onChange={(e) => handleChange('nsfr_haircut', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">Additional haircut on ASF for NSFR</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Deposit Run-off Scalar
            </label>
            <input
              type="number"
              step="0.05"
              value={params.deposit_runoff_scalar}
              onChange={(e) => handleChange('deposit_runoff_scalar', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">Multiplier for deposit run-off rates (e.g. 1.2 = 20% increase)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { ScenarioParameters } from '../types';

interface CurvePreviewProps {
    parameters?: ScenarioParameters;
}

// Base curve data (mock)
const BASE_CURVE = [
    { term: 'ON', t: 0, rate: 3.0 },
    { term: '1M', t: 0.08, rate: 3.1 },
    { term: '3M', t: 0.25, rate: 3.2 },
    { term: '6M', t: 0.5, rate: 3.4 },
    { term: '1Y', t: 1, rate: 3.6 },
    { term: '2Y', t: 2, rate: 3.8 },
    { term: '3Y', t: 3, rate: 3.9 },
    { term: '5Y', t: 5, rate: 4.0 },
    { term: '7Y', t: 7, rate: 4.1 },
    { term: '10Y', t: 10, rate: 4.2 },
    { term: '15Y', t: 15, rate: 4.3 },
    { term: '20Y', t: 20, rate: 4.3 },
    { term: '30Y', t: 30, rate: 4.2 },
];

export function CurvePreview({ parameters }: CurvePreviewProps) {
    const chartData = useMemo(() => {
        if (!parameters?.rates) return BASE_CURVE.map(p => ({ ...p, shockedRate: p.rate }));

        const { curve_type, shift_bp, shocks } = parameters.rates;

        return BASE_CURVE.map(point => {
            let shock = 0;

            if (curve_type === 'parallel_shift') {
                shock = (shift_bp || 0) / 100;
            } else if (curve_type === 'steepener') {
                // Simple steepener logic: rotate around 5Y point
                // Short end down, long end up
                shock = (point.t - 5) * 0.1;
            } else if (curve_type === 'flattener') {
                // Simple flattener logic: rotate around 5Y point
                // Short end up, long end down
                shock = -(point.t - 5) * 0.1;
            } else if (curve_type === 'custom') {
                // Find specific shock for this term if exists
                const specificShock = shocks?.find(s => s.term === point.term);
                if (specificShock) {
                    shock = specificShock.value / 100;
                }
            }

            return {
                ...point,
                shockedRate: point.rate + shock
            };
        });
    }, [parameters?.rates]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="term" stroke="#64748b" fontSize={12} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit="%" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '12px' }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="rate"
                            name="Base Curve"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="shockedRate"
                            name="Scenario Curve"
                            stroke="#4f46e5"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6 space-y-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Metrics</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-slate-400">10Y Rate</div>
                            <div className="text-lg font-bold text-slate-900">
                                {chartData.find(p => p.term === '10Y')?.shockedRate.toFixed(2)}%
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Spread 10Y-3M</div>
                            <div className="text-lg font-bold text-slate-900">
                                {((chartData.find(p => p.term === '10Y')?.shockedRate || 0) - (chartData.find(p => p.term === '3M')?.shockedRate || 0)).toFixed(2)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

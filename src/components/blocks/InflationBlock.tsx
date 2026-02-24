import { InflationParams } from '../../types';

interface InflationBlockProps {
    data?: InflationParams;
    onChange: (data: InflationParams) => void;
}

export function InflationBlock({ data, onChange }: InflationBlockProps) {
    // Initialize with default structure if empty
    const nominalConfig = data?.nominal_configuration || { name: 'COP Gov.', shock: 0 };
    const realConfig = data?.real_configuration || { name: 'UVR', shock: 0 };

    const updateConfig = (type: 'nominal' | 'real', field: 'name' | 'shock', value: string | number) => {
        const newNominal = type === 'nominal' ? { ...nominalConfig, [field]: value } : nominalConfig;
        const newReal = type === 'real' ? { ...realConfig, [field]: value } : realConfig;

        onChange({
            nominal_configuration: newNominal,
            real_configuration: newReal
        } as InflationParams);
    };

    return (
        <div className="space-y-8">
            {/* Nominal Inflation Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">Nominal Curve</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Curve Name</label>
                        <input
                            type="text"
                            value={nominalConfig.name}
                            onChange={(e) => updateConfig('nominal', 'name', e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="e.g. COP Gov."
                        />
                        <p className="mt-2 text-xs text-slate-500">Reference curve name.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Shock</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                value={nominalConfig.shock}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    updateConfig('nominal', 'shock', isNaN(val) ? 0 : val);
                                }}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-2.5 text-slate-400 text-sm">%</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Parallel shock applied to the curve.</p>
                    </div>
                </div>
            </div>

            {/* Real Inflation Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">Real Curve</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Curve Name</label>
                        <input
                            type="text"
                            value={realConfig.name}
                            onChange={(e) => updateConfig('real', 'name', e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            placeholder="e.g. UVR"
                        />
                        <p className="mt-2 text-xs text-slate-500">Reference curve name.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Shock</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                value={realConfig.shock}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    updateConfig('real', 'shock', isNaN(val) ? 0 : val);
                                }}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-2.5 text-slate-400 text-sm">%</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Parallel shock applied to the curve.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

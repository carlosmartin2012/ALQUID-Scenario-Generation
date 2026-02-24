import { useState, useEffect } from 'react';
import {
    TrendingUp,
    DollarSign,
    Percent,
    Users,
    Download,
    CheckCircle,
    ChevronRight,
    ArrowLeft,
    Sparkles,
    ShieldAlert,
    Droplets,
    ArrowRightLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import { useScenario } from '../hooks/useScenarios';
import { cn } from '../lib/utils';
import { NavItem, BlockType, RiskType } from '../types';
import { RatesBlock } from './blocks/RatesBlock';
import { BehaviorBlock } from './blocks/BehaviorBlock';
import { InflationBlock } from './blocks/InflationBlock';
import { MacroBlock } from './blocks/MacroBlock';
import { CSRBBBlock } from './blocks/CSRBBBlock';
import { LiquidityBlock } from './blocks/LiquidityBlock';
import { FXBlock } from './blocks/FXBlock';
import { AIAssistant } from './AIAssistant';

const BLOCK_DEFINITIONS: Record<string, NavItem> = {
    rates: { id: 'rates', label: 'Interest Rates', icon: Percent },
    inflation: { id: 'inflation', label: 'Inflation', icon: DollarSign },
    behavior: { id: 'behavior', label: 'Behaviors', icon: Users },
    macro: { id: 'macro', label: 'Macroeconomic', icon: TrendingUp },
    csrbb: { id: 'csrbb', label: 'Credit Spread', icon: ShieldAlert },
    liquidity: { id: 'liquidity', label: 'Liquidity', icon: Droplets },
    fx: { id: 'fx', label: 'FX Shocks', icon: ArrowRightLeft },
};

const RISK_TYPE_BLOCKS: Record<RiskType, string[]> = {
    IRRBB: ['rates', 'inflation', 'behavior'],
    CSRBB: ['csrbb'],
    Liquidity: ['liquidity'],
    FX: ['fx'],
    Macroeconomic: ['macro'],
};

interface ScenarioBuilderProps {
    scenarioId: string;
    onBack: () => void;
}

export function ScenarioBuilder({ scenarioId, onBack }: ScenarioBuilderProps) {
    const { scenario, loading, updateScenario, updateParameters } = useScenario(scenarioId);
    const [activeBlock, setActiveBlock] = useState<BlockType>('rates');
    const [isGenerating, setIsGenerating] = useState(false);

    // Determine available blocks based on risk_types
    const availableBlocks: NavItem[] = [];
    if (scenario?.risk_types) {
        const blockIds = new Set<string>();
        scenario.risk_types.forEach(risk => {
            const risks = RISK_TYPE_BLOCKS[risk];
            if (risks) {
                risks.forEach(id => blockIds.add(id));
            }
        });

        // Sort blocks in a specific order if needed, or just iterate
        // Order: Macro, Rates, Inflation, Behavior, CSRBB, Liquidity, FX
        const order = ['macro', 'rates', 'inflation', 'behavior', 'csrbb', 'liquidity', 'fx'];
        order.forEach(id => {
            if (blockIds.has(id)) {
                availableBlocks.push(BLOCK_DEFINITIONS[id] as NavItem);
            }
        });
    } else if (scenario?.risk_type === 'IRRBB') {
        // Fallback for backward compatibility
        availableBlocks.push(BLOCK_DEFINITIONS['rates'] as NavItem);
        availableBlocks.push(BLOCK_DEFINITIONS['inflation'] as NavItem);
        availableBlocks.push(BLOCK_DEFINITIONS['behavior'] as NavItem);
    }

    useEffect(() => {
        if (availableBlocks.length > 0 && !availableBlocks.find(b => b.id === activeBlock)) {
            setActiveBlock(availableBlocks[0].id as BlockType);
        }
    }, [scenario?.risk_types, availableBlocks, activeBlock]);

    if (loading || !scenario) {
        return <div className="flex-1 flex items-center justify-center text-slate-400">Loading scenario...</div>;
    }

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch(`/api/scenarios/${scenarioId}/generate`, { method: 'POST' });
            const data = await res.json();

            // Download files (simulated for now by creating blobs)
            data.files.forEach((file: any) => {
                const byteCharacters = atob(file.content);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = file.name;
                link.click();
            });
        } catch (err) {
            console.error('Failed to generate files', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAIApply = async (params: any) => {
        // Apply each block of parameters
        for (const [key, value] of Object.entries(params)) {
            if (key in scenario.parameters!) {
                await updateParameters(key as BlockType, value);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            {scenario.name}
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium border",
                                scenario.status === 'validated'
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                            )}>
                                {scenario.status}
                            </span>
                            <div className="flex gap-1">
                                {(scenario.risk_types || [scenario.risk_type || 'IRRBB']).map((rt: string) => (
                                    <span key={rt} className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                        {rt}
                                    </span>
                                ))}
                            </div>
                        </h1>
                        <p className="text-sm text-slate-500">{scenario.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => updateScenario({ status: 'validated' })}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors border border-slate-200"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Validate
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-70"
                    >
                        {isGenerating ? (
                            <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        Input Generation
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Navigation Tabs */}
                <nav className="w-64 bg-white border-r border-slate-200 overflow-y-auto py-4">
                    <div className="px-4 mb-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Configuration Blocks
                    </div>
                    <div className="space-y-1 px-2">
                        {availableBlocks.length > 0 ? availableBlocks.map(block => {
                            const Icon = block.icon;
                            const isActive = activeBlock === block.id;
                            return (
                                <button
                                    key={block.id}
                                    onClick={() => setActiveBlock(block.id as BlockType)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                        isActive
                                            ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className={cn("w-4 h-4", isActive ? "text-indigo-600" : "text-slate-400")} />
                                        {block.label}
                                    </div>
                                    {isActive && <ChevronRight className="w-4 h-4 text-indigo-400" />}
                                </button>
                            );
                        }) : (
                            <div className="px-4 py-2 text-sm text-slate-400 italic">
                                No configuration blocks available for this risk type.
                            </div>
                        )}
                    </div>
                </nav>

                {/* Editor Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Form */}
                    <div className="flex-1 overflow-y-auto p-8 border-r border-slate-200 bg-white">
                        {availableBlocks.length > 0 ? (
                            <motion.div
                                key={activeBlock}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                        {BLOCK_DEFINITIONS[activeBlock]?.icon && (
                                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                                {(() => {
                                                    const Icon = BLOCK_DEFINITIONS[activeBlock].icon;
                                                    return <Icon className="w-6 h-6" />;
                                                })()}
                                            </div>
                                        )}
                                        {BLOCK_DEFINITIONS[activeBlock]?.label} Settings
                                    </h2>
                                </div>

                                {activeBlock === 'rates' && (
                                    <RatesBlock
                                        data={scenario.parameters?.rates}
                                        onChange={(data) => updateParameters('rates', data)}
                                    />
                                )}
                                {activeBlock === 'behavior' && (
                                    <BehaviorBlock
                                        data={scenario.parameters?.behavior}
                                        onChange={(data) => updateParameters('behavior', data)}
                                    />
                                )}
                                {activeBlock === 'inflation' && (
                                    <InflationBlock
                                        data={scenario.parameters?.inflation}
                                        onChange={(data) => updateParameters('inflation', data)}
                                    />
                                )}
                                {activeBlock === 'macro' && (
                                    <MacroBlock
                                        data={scenario.parameters?.macro}
                                        onChange={(data) => updateParameters('macro', data)}
                                    />
                                )}
                                {activeBlock === 'csrbb' && (
                                    <CSRBBBlock
                                        data={scenario.parameters?.csrbb}
                                        onChange={(data) => updateParameters('csrbb', data)}
                                    />
                                )}
                                {activeBlock === 'liquidity' && (
                                    <LiquidityBlock
                                        data={scenario.parameters?.liquidity}
                                        onChange={(data) => updateParameters('liquidity', data)}
                                    />
                                )}
                                {activeBlock === 'fx' && (
                                    <FXBlock
                                        data={scenario.parameters?.fx}
                                        onChange={(data) => updateParameters('fx', data)}
                                    />
                                )}
                            </motion.div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                Select a valid risk type to configure parameters.
                            </div>
                        )}
                    </div>

                    {/* AI Copilot Panel (Replaces Live Preview) */}
                    <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg z-20">
                        <AIAssistant
                            isOpen={true}
                            onClose={() => { }}
                            onApply={handleAIApply}
                            activeBlock={activeBlock}
                            embedded={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

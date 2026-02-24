import { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, X, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScenarioParameters, BlockType } from '../types';
import { cn } from '../lib/utils';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (params: Partial<ScenarioParameters>) => void;
  activeBlock?: BlockType;
  embedded?: boolean;
}

export function AIAssistant({ isOpen, onClose, onApply, activeBlock, embedded = false }: AIAssistantProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedParams, setGeneratedParams] = useState<Partial<ScenarioParameters> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedParams(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure it in the settings.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = `
        You are an expert ALM (Asset Liability Management) scenario designer.
        Your task is to generate a JSON object representing scenario parameters based on the user's description.
        
        The JSON structure must match this TypeScript interface:
        
        interface ScenarioParameters {
          macro: {
            gdp_growth: number; // percentage, e.g. 2.5
            unemployment_rate: number; // percentage, e.g. 5.0
            cpi: number; // percentage, e.g. 2.0
          };
          rates: {
            curve_type: 'base' | 'parallel_shift' | 'steepener' | 'flattener' | 'custom';
            shift_bp: number; // basis points, e.g. 100
            shocks: Array<{ term: string; value: number }>; // term e.g. "1Y", value in bp
          };
          inflation: {
            nominal_configuration: {
              name: string;
              shock: number;
            };
            real_configuration: {
              name: string;
              shock: number;
            };
          };
          behavior: {
            nmd_models: Array<{
              id: string; // uuid
              name: string;
              beta: number; // 0 to 1
              volatile_pct: number; // percentage
              semistable_matrix: Array<{ rate: number; depo_pct: number }>;
            }>;
            prepayment_models: Array<{
              id: string; // uuid
              name: string;
              type: 'CPR' | 'SMM';
              speed_multiplier: number;
              cmpp: number;
              tpt: number;
            }>;
          };
        }

        Return ONLY the JSON object. Do not include markdown formatting or explanations.
      `;

      const userContent = activeBlock
        ? `User is currently editing the "${activeBlock}" block.\nUser description: "${prompt}"\n\nGenerate the full ScenarioParameters JSON.`
        : `User description: "${prompt}"\n\nGenerate the full ScenarioParameters JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userContent,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      const data = JSON.parse(text);
      setGeneratedParams(data);
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      setError(err.message || "Failed to generate scenario.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (generatedParams) {
      onApply(generatedParams);
      if (!embedded) onClose();
    }
  };

  const content = (
    <div className={cn("bg-white flex flex-col h-full", embedded ? "" : "w-full max-w-2xl m-4 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto max-h-[80vh]")}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-yellow-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold">ALQUID Copilot</h2>
            <p className="text-indigo-100 text-xs">Describe your scenario, and I'll build it.</p>
          </div>
        </div>
        {!embedded && (
          <button
            title="Close Sidebar"
            aria-label="Close Sidebar"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto flex-1">
        {!generatedParams ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                What kind of scenario do you want to simulate?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A severe global recession with high inflation, 200bp rate hike, and widening credit spreads..."
                className="w-full h-32 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-700 placeholder:text-slate-400"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <X className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Scenario
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg text-sm font-medium">
              <Check className="w-4 h-4" />
              Scenario generated successfully! Review the parameters below.
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-xs text-slate-600 overflow-auto max-h-60">
              <pre>{JSON.stringify(generatedParams, null, 2)}</pre>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setGeneratedParams(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleApply}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                Apply Parameters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full flex justify-center pointer-events-auto"
          >
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

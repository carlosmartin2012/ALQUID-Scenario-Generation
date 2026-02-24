import { LucideIcon } from 'lucide-react';

export type RiskType = 'IRRBB' | 'CSRBB' | 'Liquidity' | 'FX' | 'Macroeconomic';

export interface Scenario {
    id: string;
    name: string;
    description: string;
    status: 'draft' | 'validated' | 'archived';
    base_date: string;
    tags: string[];
    risk_types: RiskType[];
    created_at: string;
    updated_at: string;
    version: number;
    parameters?: ScenarioParameters;
}

export interface ScenarioParameters {
    macro: MacroParams;
    rates: RatesParams;
    inflation: InflationParams;
    behavior: BehaviorParams;
    csrbb: CSRBBParams;
    liquidity: LiquidityParams;
    fx: FXParams;
}

export interface MacroParams {
    gdp_growth: number;
    unemployment_rate: number;
    cpi: number;
    house_price_index: number;
}

export interface CSRBBParams {
    spread_shocks: {
        sector: string;
        rating: string;
        shock_bp: number;
    }[];
}

export interface LiquidityParams {
    lcr_haircut: number; // %
    nsfr_haircut: number; // %
    deposit_runoff_scalar: number; // multiplier
}

export interface FXParams {
    shocks: {
        currency_pair: string;
        shock_pct: number;
    }[];
}

export interface RatesParams {
    curve_type: 'base' | 'parallel_shift' | 'steepener' | 'flattener' | 'custom';
    shift_bp: number; // basis points
    shocks: {
        term: string; // 1M, 3M, etc.
        value: number;
    }[];
}

export interface InflationParams {
    nominal_configuration: {
        name: string;
        shock: number;
    };
    real_configuration: {
        name: string;
        shock: number;
    };
}

export interface NMDModel {
    id: string;
    name: string;
    beta: number;
    volatile_pct: number;
    semistable_matrix: { rate: number; depo_pct: number }[];
}

export interface PrepaymentModel {
    id: string;
    name: string;
    type: 'CPR' | 'SMM';
    speed_multiplier: number;
    cmpp: number;
    tpt: number;
}

export interface BehaviorParams {
    nmd_models: NMDModel[];
    prepayment_models: PrepaymentModel[];
}

export type BlockType = keyof ScenarioParameters;

export interface NavItem {
    id: BlockType;
    label: string;
    icon: LucideIcon;
}

import * as XLSX from 'xlsx';

export const excelService = {
    generateScenarioFiles: (scenario: any, params: any) => {
        // 1. market_data_template.xlsx
        const wbMarket = XLSX.utils.book_new();

        const ratesData = [
            ['Term', 'Base Rate', 'Shocked Rate'],
            ['1M', 0.03, 0.035],
            ['3M', 0.032, 0.037],
            ['6M', 0.035, 0.040],
            ['1Y', 0.040, 0.045],
            ['5Y', 0.045, 0.050],
            ['10Y', 0.050, 0.055],
        ];

        const wsRates = XLSX.utils.aoa_to_sheet(ratesData);
        XLSX.utils.book_append_sheet(wbMarket, wsRates, "Interest Rates");

        const fxData = [['Currency', 'Rate'], ['USD', 1.1], ['GBP', 0.85]];
        const wsFX = XLSX.utils.aoa_to_sheet(fxData);
        XLSX.utils.book_append_sheet(wbMarket, wsFX, "FX");

        // 2. behavior_template.xlsx
        const wbBehavior = XLSX.utils.book_new();
        const behaviorData = [['Product', 'Prepayment Rate'], ['Mortgage', 0.05], ['Loan', 0.10]];
        const wsBehavior = XLSX.utils.aoa_to_sheet(behaviorData);
        XLSX.utils.book_append_sheet(wbBehavior, wsBehavior, "Prepayments");

        // 3. modelization_template.xlsx
        const wbModel = XLSX.utils.book_new();
        const modelData = [['Product', 'Volume Growth'], ['Mortgage', 0.02], ['Deposits', 0.03]];
        const wsModel = XLSX.utils.aoa_to_sheet(modelData);
        XLSX.utils.book_append_sheet(wbModel, wsModel, "New Business");

        return [
            { name: 'market_data_template.xlsx', content: XLSX.write(wbMarket, { type: 'buffer', bookType: 'xlsx' }).toString('base64') },
            { name: 'behavior_template.xlsx', content: XLSX.write(wbBehavior, { type: 'buffer', bookType: 'xlsx' }).toString('base64') },
            { name: 'modelization_template.xlsx', content: XLSX.write(wbModel, { type: 'buffer', bookType: 'xlsx' }).toString('base64') }
        ];
    }
};

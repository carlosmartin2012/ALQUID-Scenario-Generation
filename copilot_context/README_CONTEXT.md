# Project Context: ALQUID & Scenario Generation

This directory contains key documentation and data templates used to train or provide context for the Scenario Generator project.

## Files Analysis

### [ALQUID_user_manual_vigente.pdf](file:///C:/Users/carlos.martin/Desktop/Prueba/Scenario%20Generator/copilot_context/ALQUID_user_manual_vigente.pdf)
- **Role**: Core Business Logic Reference.
- **Content**: Detailed explanation of the ALQUID engine, methodology for scenario generation, and functional specifications. Use this to understand the financial logic behind the code.

### Dummy Templates (`dummy_templates/`)
These files demonstrate the expected input/output structure for the ALQUID engine.

- **[01. Market_Data_Definition.xlsx](file:///C:/Users/carlos.martin/Desktop/Prueba/Scenario%20Generator/copilot_context/dummy_templates/01.%20Market_Data_Definition.xlsx)**: Defines the market data structures (Yield curves, FX, etc.).
- **[02. Behaviour_Definition_CER.xlsx](file:///C:/Users/carlos.martin/Desktop/Prueba/Scenario%20Generator/copilot_context/dummy_templates/02.%20Behaviour_Definition_CER.xlsx)**: Definition of behavioral models (prepayments, decay, etc.).
- **[03. Modelización.xlsx](file:///C:/Users/carlos.martin/Desktop/Prueba/Scenario%20Generator/copilot_context/dummy_templates/03.%20Modelizaci%C3%B3n.xlsx)**: Modeling parameters and assumptions.
- **[04. Market_Data.xlsx](file:///C:/Users/carlos.martin/Desktop/Prueba/Scenario%20Generator/copilot_context/dummy_templates/04.%20Market_Data.xlsx)**: Example of raw market data values.
- **[05. Behaviour_Data_CER_prueba_CCR.xlsx](file:///C:/Users/carlos.martin/Desktop/Prueba/Scenario%20Generator/copilot_context/dummy_templates/05.%20Behaviour_Data_CER_prueba_CCR.xlsx)**: Example behavioral data.
- **[Alquid_Input_202601.csv](file:///C:/Users/carlos.martin/Desktop/Prueba/Scenario%20Generator/copilot_context/dummy_templates/Alquid_Input_202601.csv)**: Low-level CSV format for contract/pool data. Columns include `POOL_ID`, `CONTRACT_ID`, `BALANCE_DATE`, `CURRENCY`, `COUPON_TODAY`, etc.

## How to use this context
When working with Scenario Generator, always refer to these files to ensure data types, column names, and financial calculations align with the ALQUID methodology.

import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Initialize Database
const db = new Database('scenarios.db');
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft', -- draft, validated, archived
    base_date TEXT,
    tags TEXT, -- JSON array
    risk_type TEXT DEFAULT 'IRRBB',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS scenario_parameters (
    scenario_id TEXT,
    block_type TEXT, -- macro, rates, inflation, liquidity, fx, credit, behavior
    data TEXT, -- JSON object
    PRIMARY KEY (scenario_id, block_type),
    FOREIGN KEY(scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id TEXT,
    action TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    details TEXT
  );
`);

// Seed default scenario if requested
try {
  // Migration to add risk_types if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(scenarios)").all();
    const hasRiskTypes = tableInfo.some((col: any) => col.name === 'risk_types');
    if (!hasRiskTypes) {
      db.prepare("ALTER TABLE scenarios ADD COLUMN risk_types TEXT DEFAULT '[\"IRRBB\"]'").run();
      console.log("Added risk_types column to scenarios table");

      // Migrate existing risk_type to risk_types if risk_type exists
      const hasRiskType = tableInfo.some((col: any) => col.name === 'risk_type');
      if (hasRiskType) {
        const scenarios = db.prepare("SELECT id, risk_type FROM scenarios").all();
        const updateStmt = db.prepare("UPDATE scenarios SET risk_types = ? WHERE id = ?");
        scenarios.forEach((s: any) => {
          const types = s.risk_type ? [s.risk_type] : ['IRRBB'];
          updateStmt.run(JSON.stringify(types), s.id);
        });
      }
    }
  } catch (err) {
    console.error("Migration error:", err);
  }

  // Seed default scenario if requested
  try {
    const seedStmt = db.prepare("SELECT count(*) as count FROM scenarios WHERE name = 'Inflation Stress'");
    const count = seedStmt.get() as { count: number };

    if (count.count === 0) {
      const id = uuidv4();
      const stmt = db.prepare(`
          INSERT INTO scenarios (id, name, description, tags, base_date, status, risk_types)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

      stmt.run(id, 'Inflation Stress', 'Dummy scenario for testing', '[]', '2025-12-31', 'draft', JSON.stringify(['IRRBB']));

      // Initialize default parameters for all blocks
      const blocks = ['macro', 'rates', 'inflation', 'behavior', 'csrbb', 'liquidity', 'fx'];
      const insertParam = db.prepare('INSERT INTO scenario_parameters (scenario_id, block_type, data) VALUES (?, ?, ?)');

      blocks.forEach(block => {
        insertParam.run(id, block, '{}');
      });
    }
  } catch (err) {
    console.error("Seeding failed:", err);
  }
} catch (err) {
  console.error("Seeding failed:", err);
}

// Database persistence enabled
async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(express.json());

  // --- API Routes ---

  // GET /api/scenarios
  app.get('/api/scenarios', (req, res) => {
    const stmt = db.prepare('SELECT * FROM scenarios ORDER BY updated_at DESC');
    const scenarios = stmt.all();
    res.json(scenarios.map((s: any) => ({
      ...s,
      tags: JSON.parse(s.tags || '[]'),
      risk_types: JSON.parse(s.risk_types || '["IRRBB"]')
    })));
  });

  // GET /api/scenarios/:id
  app.get('/api/scenarios/:id', (req, res) => {
    const { id } = req.params;
    const scenarioStmt = db.prepare('SELECT * FROM scenarios WHERE id = ?');
    const scenario = scenarioStmt.get(id) as any;

    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const paramsStmt = db.prepare('SELECT block_type, data FROM scenario_parameters WHERE scenario_id = ?');
    const params = paramsStmt.all(id) as any[];

    const parameters: Record<string, any> = {};
    params.forEach(p => {
      parameters[p.block_type] = JSON.parse(p.data);
    });

    res.json({
      ...scenario,
      tags: JSON.parse(scenario.tags || '[]'),
      risk_types: JSON.parse(scenario.risk_types || '["IRRBB"]'),
      parameters
    });
  });

  // POST /api/scenarios
  app.post('/api/scenarios', (req, res) => {
    const { name, description, tags, base_date, risk_types } = req.body;
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO scenarios (id, name, description, tags, base_date, risk_types)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, description, JSON.stringify(tags || []), base_date || new Date().toISOString().split('T')[0], JSON.stringify(risk_types || ['IRRBB']));

    // Initialize default parameters for all blocks
    // Initialize all blocks, they will be filtered by UI
    const blocks = ['macro', 'rates', 'inflation', 'behavior', 'csrbb', 'liquidity', 'fx'];
    const insertParam = db.prepare('INSERT INTO scenario_parameters (scenario_id, block_type, data) VALUES (?, ?, ?)');

    blocks.forEach(block => {
      insertParam.run(id, block, '{}');
    });

    // Audit log
    db.prepare('INSERT INTO audit_log (scenario_id, action, details) VALUES (?, ?, ?)').run(id, 'CREATE', 'Scenario created');

    res.json({ id });
  });

  // POST /api/scenarios/copy-date
  app.post('/api/scenarios/copy-date', (req, res) => {
    const { source_date, target_date } = req.body;

    if (!source_date || !target_date) {
      return res.status(400).json({ error: 'Source and target dates are required' });
    }

    const scenarios = db.prepare('SELECT * FROM scenarios WHERE base_date = ?').all(source_date) as any[];

    const createdIds: string[] = [];
    const insertScenario = db.prepare(`
      INSERT INTO scenarios (id, name, description, tags, base_date, status, risk_types, risk_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertParam = db.prepare('INSERT INTO scenario_parameters (scenario_id, block_type, data) VALUES (?, ?, ?)');

    db.transaction(() => {
      scenarios.forEach(s => {
        const newId = uuidv4();
        createdIds.push(newId);

        // Copy scenario
        insertScenario.run(
          newId,
          s.name,
          s.description,
          s.tags,
          target_date,
          'draft',
          s.risk_types || JSON.stringify(['IRRBB']),
          s.risk_type || 'IRRBB' // Keep for backward compatibility if needed
        );

        // Copy parameters
        const params = db.prepare('SELECT block_type, data FROM scenario_parameters WHERE scenario_id = ?').all(s.id) as any[];
        params.forEach(p => {
          insertParam.run(newId, p.block_type, p.data);
        });

        db.prepare('INSERT INTO audit_log (scenario_id, action, details) VALUES (?, ?, ?)').run(newId, 'COPY', `Copied from ${s.id} (${source_date})`);
      });
    })();

    res.json({ count: createdIds.length, ids: createdIds });
  });

  // PUT /api/scenarios/:id
  app.put('/api/scenarios/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, tags, status, parameters, risk_types } = req.body;

    const updateScenario = db.prepare(`
      UPDATE scenarios 
      SET name = COALESCE(?, name), 
          description = COALESCE(?, description), 
          tags = COALESCE(?, tags),
          status = COALESCE(?, status),
          risk_types = COALESCE(?, risk_types),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    updateScenario.run(name, description, tags ? JSON.stringify(tags) : null, status, risk_types ? JSON.stringify(risk_types) : null, id);

    if (parameters) {
      const updateParam = db.prepare(`
        INSERT INTO scenario_parameters (scenario_id, block_type, data) 
        VALUES (?, ?, ?)
        ON CONFLICT(scenario_id, block_type) DO UPDATE SET data = excluded.data
      `);

      Object.entries(parameters).forEach(([block, data]) => {
        updateParam.run(id, block, JSON.stringify(data));
      });
    }

    db.prepare('INSERT INTO audit_log (scenario_id, action, details) VALUES (?, ?, ?)').run(id, 'UPDATE', 'Scenario updated');

    res.json({ success: true });
  });

  // DELETE /api/scenarios/:id
  app.delete('/api/scenarios/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // POST /api/scenarios/:id/generate
  app.post('/api/scenarios/:id/generate', (req, res) => {
    const { id } = req.params;
    // Fetch scenario data
    const scenarioStmt = db.prepare('SELECT * FROM scenarios WHERE id = ?');
    const scenario = scenarioStmt.get(id) as any;

    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

    const paramsStmt = db.prepare('SELECT block_type, data FROM scenario_parameters WHERE scenario_id = ?');
    const paramsRows = paramsStmt.all(id) as any[];
    const params: Record<string, any> = {};
    paramsRows.forEach(p => params[p.block_type] = JSON.parse(p.data));

    // --- Generate Excel Files ---

    // 1. market_data_template.xlsx
    const wbMarket = XLSX.utils.book_new();

    // Interest Rates Sheet
    const ratesData = [
      ['Term', 'Base Rate', 'Shocked Rate'],
      ['1M', 0.03, 0.03 + (params.rates?.shift_bp || 0) / 10000],
      ['3M', 0.032, 0.032 + (params.rates?.shift_bp || 0) / 10000],
      ['6M', 0.035, 0.035 + (params.rates?.shift_bp || 0) / 10000],
      ['1Y', 0.040, 0.040 + (params.rates?.shift_bp || 0) / 10000],
      ['5Y', 0.045, 0.045 + (params.rates?.shift_bp || 0) / 10000],
      ['10Y', 0.050, 0.050 + (params.rates?.shift_bp || 0) / 10000],
    ];
    const wsRates = XLSX.utils.aoa_to_sheet(ratesData);
    XLSX.utils.book_append_sheet(wbMarket, wsRates, "Interest Rates");

    // Inflation Sheet
    const inflationData = [['Type', 'Curve Name', 'Shock']];

    if (params.inflation) {
      const { nominal_configuration, real_configuration } = params.inflation;

      if (nominal_configuration) {
        inflationData.push(['Nominal', nominal_configuration.name || 'COP Gov.', nominal_configuration.shock || 0]);
      }

      if (real_configuration) {
        inflationData.push(['Real', real_configuration.name || 'UVR', real_configuration.shock || 0]);
      }
    }

    const wsInflation = XLSX.utils.aoa_to_sheet(inflationData);
    XLSX.utils.book_append_sheet(wbMarket, wsInflation, "Inflation");

    // 2. behavior_template.xlsx
    const wbBehavior = XLSX.utils.book_new();

    // NMDs Sheet
    const nmdData = [['Model Name', 'Beta', '% Volatile', 'Rate %', 'Depo %']];
    if (params.behavior?.nmd_models) {
      params.behavior.nmd_models.forEach((model: any) => {
        if (model.semistable_matrix && model.semistable_matrix.length > 0) {
          model.semistable_matrix.forEach((row: any) => {
            nmdData.push([model.name, model.beta, model.volatile_pct, row.rate, row.depo_pct]);
          });
        } else {
          nmdData.push([model.name, model.beta, model.volatile_pct, '', '']);
        }
      });
    }
    const wsNMD = XLSX.utils.aoa_to_sheet(nmdData);
    XLSX.utils.book_append_sheet(wbBehavior, wsNMD, "NMDs");

    // Prepayments Sheet
    const prepaymentData = [['Model Name', 'Type', 'Speed Multiplier', 'CMPP', 'TPT']];
    if (params.behavior?.prepayment_models) {
      params.behavior.prepayment_models.forEach((model: any) => {
        prepaymentData.push([model.name, model.type, model.speed_multiplier, model.cmpp, model.tpt]);
      });
    }
    const wsPrepayment = XLSX.utils.aoa_to_sheet(prepaymentData);
    XLSX.utils.book_append_sheet(wbBehavior, wsPrepayment, "Prepayments");

    // Write files to buffer
    const marketBuffer = XLSX.write(wbMarket, { type: 'buffer', bookType: 'xlsx' });
    const behaviorBuffer = XLSX.write(wbBehavior, { type: 'buffer', bookType: 'xlsx' });

    // For simplicity in this demo, we'll return a JSON with base64 strings
    // In production, we might zip them or return download links
    res.json({
      files: [
        { name: 'market_data_template.xlsx', content: marketBuffer.toString('base64') },
        { name: 'behavior_template.xlsx', content: behaviorBuffer.toString('base64') }
      ]
    });
  });


  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized");
    } catch (e) {
      console.error("Failed to initialize Vite middleware", e);
    }
  } else {
    // Production static serving (if needed in the future)
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

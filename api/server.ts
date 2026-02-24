import express from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Initialization for Vercel (Writeable /tmp) ---
const IS_VERCEL = !!process.env.VERCEL;
const DB_FILENAME = 'scenarios.db';
const READ_ONLY_DB_PATH = path.join(process.cwd(), DB_FILENAME);
const WRITABLE_DB_PATH = IS_VERCEL ? path.join('/tmp', DB_FILENAME) : READ_ONLY_DB_PATH;

if (IS_VERCEL && !fs.existsSync(WRITABLE_DB_PATH)) {
    try {
        fs.copyFileSync(READ_ONLY_DB_PATH, WRITABLE_DB_PATH);
        console.log('Database copied to /tmp for writing');
    } catch (err) {
        console.error('Failed to copy database to /tmp:', err);
    }
}

const db = new Database(WRITABLE_DB_PATH);
db.pragma('journal_mode = WAL');

// Initial Table Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    base_date TEXT,
    tags TEXT,
    risk_type TEXT DEFAULT 'IRRBB',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version INTEGER DEFAULT 1,
    risk_types TEXT DEFAULT '["IRRBB"]'
  );

  CREATE TABLE IF NOT EXISTS scenario_parameters (
    scenario_id TEXT,
    block_type TEXT,
    data TEXT,
    PRIMARY KEY (scenario_id, block_type),
    FOREIGN KEY(scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
  );
`);

// --- API Routes ---
const router = express.Router();

router.get('/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected', writable: WRITABLE_DB_PATH });
});

router.get('/scenarios', (req, res) => {
    const scenarios = db.prepare('SELECT * FROM scenarios ORDER BY updated_at DESC').all();
    res.json(scenarios.map((s: any) => ({
        ...s,
        tags: JSON.parse(s.tags || '[]'),
        risk_types: JSON.parse(s.risk_types || '["IRRBB"]')
    })));
});

router.post('/scenarios', (req, res) => {
    const { name, description, tags, base_date, risk_types } = req.body;
    const id = uuidv4();
    db.prepare(`INSERT INTO scenarios (id, name, description, tags, base_date, risk_types) VALUES (?, ?, ?, ?, ?, ?)`).run(
        id, name, description, JSON.stringify(tags || []), base_date || new Date().toISOString().split('T')[0], JSON.stringify(risk_types || ['IRRBB'])
    );
    const blocks = ['macro', 'rates', 'inflation', 'behavior', 'csrbb', 'liquidity', 'fx'];
    const insertParam = db.prepare('INSERT INTO scenario_parameters (scenario_id, block_type, data) VALUES (?, ?, ?)');
    blocks.forEach(block => insertParam.run(id, block, '{}'));
    res.json({ id });
});

router.get('/scenarios/:id', (req, res) => {
    const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.id) as any;
    if (!scenario) return res.status(404).json({ error: 'Not found' });
    const params = db.prepare('SELECT block_type, data FROM scenario_parameters WHERE scenario_id = ?').all(req.params.id) as any[];
    const parameters: Record<string, any> = {};
    params.forEach(p => parameters[p.block_type] = JSON.parse(p.data));
    res.json({ ...scenario, tags: JSON.parse(scenario.tags || '[]'), risk_types: JSON.parse(scenario.risk_types || '["IRRBB"]'), parameters });
});

router.delete('/scenarios/:id', (req, res) => {
    db.prepare('DELETE FROM scenarios WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// Mount router on /api
app.use('/api', router);

// --- Local Dev & SPA Fallback ---
if (!IS_VERCEL) {
    const PORT = 3001;
    async function setupDev() {
        const { createServer } = await import('vite');
        const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
        app.use(vite.middlewares);
        app.listen(PORT, () => console.log(`Dev Server: http://localhost:${PORT}`));
    }
    setupDev();
} else {
    // Production static serving on Vercel is handled by rewrites in vercel.json, 
    // but we can serve files in dist as fallback if needed.
    app.use(express.static(path.join(process.cwd(), 'dist')));
}

export default app;

import db from '../db';
import { v4 as uuidv4 } from 'uuid';

export const scenarioService = {
    getAll: () => {
        const stmt = db.prepare('SELECT * FROM scenarios ORDER BY updated_at DESC');
        const scenarios = stmt.all();
        return scenarios.map((s: any) => ({
            ...s,
            tags: JSON.parse(s.tags || '[]')
        }));
    },

    getById: (id: string) => {
        const scenarioStmt = db.prepare('SELECT * FROM scenarios WHERE id = ?');
        const scenario = scenarioStmt.get(id) as any;

        if (!scenario) return null;

        const paramsStmt = db.prepare('SELECT block_type, data FROM scenario_parameters WHERE scenario_id = ?');
        const params = paramsStmt.all(id) as any[];

        const parameters: Record<string, any> = {};
        params.forEach(p => {
            parameters[p.block_type] = JSON.parse(p.data);
        });

        return {
            ...scenario,
            tags: JSON.parse(scenario.tags || '[]'),
            parameters
        };
    },

    create: (data: { name: string, description?: string, tags?: string[], base_date?: string }) => {
        const id = uuidv4();
        const stmt = db.prepare(`
      INSERT INTO scenarios (id, name, description, tags, base_date)
      VALUES (?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            data.name,
            data.description || '',
            JSON.stringify(data.tags || []),
            data.base_date || new Date().toISOString().split('T')[0]
        );

        // Initialize default parameters
        const blocks = ['macro', 'rates', 'inflation', 'liquidity', 'fx', 'credit', 'behavior'];
        const insertParam = db.prepare('INSERT INTO scenario_parameters (scenario_id, block_type, data) VALUES (?, ?, ?)');

        blocks.forEach(block => {
            insertParam.run(id, block, '{}');
        });

        db.prepare('INSERT INTO audit_log (scenario_id, action, details) VALUES (?, ?, ?)').run(id, 'CREATE', 'Scenario created');
        return id;
    },

    update: (id: string, data: any) => {
        const { name, description, tags, status, parameters } = data;

        const updateScenario = db.prepare(`
      UPDATE scenarios 
      SET name = COALESCE(?, name), 
          description = COALESCE(?, description), 
          tags = COALESCE(?, tags),
          status = COALESCE(?, status),
          updated_at = datetime('now')
      WHERE id = ?
    `);

        updateScenario.run(name, description, tags ? JSON.stringify(tags) : null, status, id);

        if (parameters) {
            const updateParam = db.prepare(`
        INSERT INTO scenario_parameters (scenario_id, block_type, data) 
        VALUES (?, ?, ?)
        ON CONFLICT(scenario_id, block_type) DO UPDATE SET data = excluded.data
      `);

            Object.entries(parameters).forEach(([block, blockData]) => {
                updateParam.run(id, block, JSON.stringify(blockData));
            });
        }

        db.prepare('INSERT INTO audit_log (scenario_id, action, details) VALUES (?, ?, ?)').run(id, 'UPDATE', 'Scenario updated');
        return true;
    },

    delete: (id: string) => {
        db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
        return true;
    }
};

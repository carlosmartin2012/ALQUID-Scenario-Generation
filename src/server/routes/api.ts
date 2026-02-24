import { Router } from 'express';
import { scenarioService } from '../services/scenarioService';
import { excelService } from '../services/excelService';

const router = Router();

router.get('/scenarios', (req, res) => {
    try {
        const scenarios = scenarioService.getAll();
        res.json(scenarios);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch scenarios' });
    }
});

router.get('/scenarios/:id', (req, res) => {
    try {
        const scenario = scenarioService.getById(req.params.id);
        if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
        res.json(scenario);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch scenario' });
    }
});

router.post('/scenarios', (req, res) => {
    try {
        const id = scenarioService.create(req.body);
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create scenario' });
    }
});

router.put('/scenarios/:id', (req, res) => {
    try {
        scenarioService.update(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update scenario' });
    }
});

router.delete('/scenarios/:id', (req, res) => {
    try {
        scenarioService.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete scenario' });
    }
});

router.post('/scenarios/:id/generate', (req, res) => {
    try {
        const scenario = scenarioService.getById(req.params.id);
        if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

        const files = excelService.generateScenarioFiles(scenario, scenario.parameters);
        res.json({ files });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate files' });
    }
});

export default router;

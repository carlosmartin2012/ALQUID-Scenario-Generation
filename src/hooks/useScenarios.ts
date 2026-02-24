import { useState, useEffect } from 'react';
import { Scenario, ScenarioParameters } from '../types';

export function useScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/scenarios')
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setScenarios(data);
        } else {
          console.error('API returned non-array data:', data);
          setScenarios([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch scenarios', err);
        setScenarios([]);
        setLoading(false);
      });
  }, []);

  const createScenario = async (name: string, description: string, base_date?: string, risk_types?: string[]) => {
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, base_date, risk_types, tags: [] })
    });
    const data = await res.json();
    // Refresh list
    const listRes = await fetch('/api/scenarios');
    const list = await listRes.json();
    setScenarios(list);
    return data.id;
  };

  const copyScenariosFromDate = async (source_date: string, target_date: string) => {
    const res = await fetch('/api/scenarios/copy-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_date, target_date })
    });
    const data = await res.json();
    // Refresh list
    const listRes = await fetch('/api/scenarios');
    const list = await listRes.json();
    setScenarios(list);
    return data;
  };

  const deleteScenario = async (id: string) => {
    const res = await fetch(`/api/scenarios/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error('Failed to delete scenario');
    }
    setScenarios(prev => prev.filter(s => s.id !== id));
  };

  return { scenarios, loading, createScenario, deleteScenario, copyScenariosFromDate };
}

export function useScenario(id: string) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/scenarios/${id}`)
      .then(res => res.json())
      .then(data => {
        setScenario(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch scenario', err);
        setLoading(false);
      });
  }, [id]);

  const updateScenario = async (updates: Partial<Scenario>) => {
    if (!scenario) return;
    await fetch(`/api/scenarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    setScenario(prev => prev ? { ...prev, ...updates } : null);
  };

  const updateParameters = async (block: keyof ScenarioParameters, data: any) => {
    if (!scenario) return;
    const newParams = { ...scenario.parameters, [block]: data };
    await fetch(`/api/scenarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parameters: { [block]: data } })
    });
    setScenario(prev => prev ? { ...prev, parameters: newParams as any } : null);
  };

  return { scenario, loading, updateScenario, updateParameters };
}

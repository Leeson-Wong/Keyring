import { useState, useEffect, useCallback } from 'react';
import type { KeyEntry, CreateKeyInput, UpdateKeyInput } from './types/keyring';

const API = '/api';

// ─── Helpers ───

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

function statusBadge(s: string): string {
  return s === 'active' ? 'bg-green-900 text-green-300' : s === 'revoked' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300';
}

// ─── Main App ───

export default function App() {
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [meta, setMeta] = useState<{ platforms: string[]; functions: string[]; tags: string[] }>({ platforms: [], functions: [], tags: [] });
  const [filter, setFilter] = useState({ platform: '', function: '', status: '', keyword: '' });
  const [showModal, setShowModal] = useState<'create' | 'edit' | 'versions' | null>(null);
  const [selected, setSelected] = useState<KeyEntry | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [keysRes, metaRes] = await Promise.all([
      fetch(`${API}/keys`).then(r => r.json()),
      fetch(`${API}/meta`).then(r => r.json()),
    ]);
    setKeys(keysRes);
    setMeta(metaRes);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = keys.filter(k => {
    if (filter.platform && !k.platform.toLowerCase().includes(filter.platform.toLowerCase())) return false;
    if (filter.function && !k.function.toLowerCase().includes(filter.function.toLowerCase())) return false;
    if (filter.status && k.status !== filter.status) return false;
    if (filter.keyword) {
      const q = filter.keyword.toLowerCase();
      const text = [k.platform, k.function, k.endpoint, k.name, k.notes, ...k.models, ...k.tags].join(' ').toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  async function handleCreate(input: CreateKeyInput) {
    await fetch(`${API}/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    setShowModal(null);
    load();
  }

  async function handleUpdate(id: string, input: UpdateKeyInput) {
    await fetch(`${API}/keys/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    setShowModal(null);
    load();
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this key? (soft delete)')) return;
    await fetch(`${API}/keys/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleVersions(id: string) {
    const res = await fetch(`${API}/keys/${id}/versions`);
    const data = await res.json();
    setVersions(data);
    setShowModal('versions');
  }

  async function copyKey(key: string, id: string) {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔑</span>
          <h1 className="text-xl font-bold">Keyring</h1>
          <span className="text-zinc-500 text-sm">API Key Manager</span>
        </div>
        <button
          onClick={() => { setSelected(null); setShowModal('create'); }}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Add Key
        </button>
      </header>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-zinc-800 flex gap-3 flex-wrap items-center">
        <input
          placeholder="Search..."
          value={filter.keyword}
          onChange={e => setFilter(f => ({ ...f, keyword: e.target.value }))}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm w-64 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
        />
        <select value={filter.platform} onChange={e => setFilter(f => ({ ...f, platform: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none">
          <option value="">All Platforms</option>
          {meta.platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filter.function} onChange={e => setFilter(f => ({ ...f, function: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none">
          <option value="">All Functions</option>
          {meta.functions.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
        <span className="text-zinc-500 text-xs ml-auto">{filtered.length} / {keys.length} keys</span>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-left border-b border-zinc-800">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Platform</th>
                <th className="pb-2 pr-4">Function</th>
                <th className="pb-2 pr-4">Endpoint</th>
                <th className="pb-2 pr-4">Models</th>
                <th className="pb-2 pr-4">Key</th>
                <th className="pb-2 pr-4">Tags</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(k => (
                <tr key={k.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-2.5 pr-4 font-medium">{k.name}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{k.platform}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{k.function}</td>
                  <td className="py-2.5 pr-4 text-zinc-500 max-w-48 truncate" title={k.endpoint}>{k.endpoint || '-'}</td>
                  <td className="py-2.5 pr-4 text-zinc-500 max-w-48 truncate" title={k.models.join(', ')}>{k.models.length ? k.models.join(', ') : '-'}</td>
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-xs text-zinc-400">{maskKey(k.apiKey)}</span>
                    <button onClick={() => copyKey(k.apiKey, k.id)} className="ml-2 text-zinc-500 hover:text-zinc-300" title="Copy full key">
                      {copiedId === k.id ? '✓' : '📋'}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex gap-1 flex-wrap">
                      {k.tags.map(t => <span key={t} className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-xs">{t}</span>)}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusBadge(k.status)}`}>{k.status}</span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelected(k); setShowModal('edit'); }} className="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
                      <button onClick={() => handleVersions(k.id)} className="text-zinc-400 hover:text-zinc-300 text-xs">History</button>
                      {k.status === 'active' && <button onClick={() => handleRevoke(k.id)} className="text-red-400 hover:text-red-300 text-xs">Revoke</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-zinc-500">No keys found. Click "+ Add Key" to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal === 'create' && <KeyForm mode="create" initial={null} onSubmit={handleCreate as any} onClose={() => setShowModal(null)} />}
      {showModal === 'edit' && selected && <KeyForm mode="edit" initial={selected} onSubmit={(input) => handleUpdate(selected.id, input as UpdateKeyInput)} onClose={() => setShowModal(null)} />}

      {/* Version History Modal */}
      {showModal === 'versions' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Version History</h2>
              <button onClick={() => setShowModal(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            {versions.length === 0 ? (
              <p className="text-zinc-500">No version history.</p>
            ) : (
              <div className="space-y-3">
                {versions.map((v: any) => (
                  <div key={v.version} className="bg-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-blue-400 font-mono">v{v.version}</span>
                      <span className="text-zinc-500">{new Date(v.timestamp).toLocaleString()}</span>
                    </div>
                    {v.changeNote && <p className="text-zinc-400 text-sm mb-2">{v.changeNote}</p>}
                    <div className="text-xs text-zinc-500 font-mono space-y-0.5">
                      <div>Platform: {v.snapshot.platform} | Function: {v.snapshot.function}</div>
                      <div>Key: {maskKey(v.snapshot.apiKey)} | Status: {v.snapshot.status}</div>
                      {v.snapshot.endpoint && <div>Endpoint: {v.snapshot.endpoint}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Key Form Component ───

function KeyForm({ mode, initial, onSubmit, onClose }: {
  mode: 'create' | 'edit';
  initial: KeyEntry | null;
  onSubmit: (input: CreateKeyInput & { changeNote?: string }) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    platform: initial?.platform || '',
    function: initial?.function || '',
    endpoint: initial?.endpoint || '',
    models: initial?.models.join(', ') || '',
    apiKey: initial?.apiKey || '',
    name: initial?.name || '',
    tags: initial?.tags.join(', ') || '',
    notes: initial?.notes || '',
    changeNote: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      platform: form.platform,
      function: form.function,
      endpoint: form.endpoint || undefined,
      models: form.models ? form.models.split(',').map(m => m.trim()).filter(Boolean) : undefined,
      apiKey: form.apiKey || undefined,
      name: form.name || undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      notes: form.notes || undefined,
      changeNote: form.changeNote || undefined,
    });
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">{mode === 'create' ? 'Add New Key' : 'Edit Key'}</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Platform *</label>
            <input required value={form.platform} onChange={e => set('platform', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="openai" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Function *</label>
            <input required value={form.function} onChange={e => set('function', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="llm" />
          </div>
        </div>

        <div>
          <label className="text-zinc-400 text-xs mb-1 block">API Key *</label>
          <input required={mode === 'create'} value={form.apiKey} onChange={e => set('apiKey', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" placeholder="sk-..." type="password" />
        </div>

        <div>
          <label className="text-zinc-400 text-xs mb-1 block">Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="My OpenAI key" />
        </div>

        <div>
          <label className="text-zinc-400 text-xs mb-1 block">Endpoint</label>
          <input value={form.endpoint} onChange={e => set('endpoint', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="https://api.openai.com/v1" />
        </div>

        <div>
          <label className="text-zinc-400 text-xs mb-1 block">Models (comma separated)</label>
          <input value={form.models} onChange={e => set('models', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="gpt-4o, gpt-4o-mini" />
        </div>

        <div>
          <label className="text-zinc-400 text-xs mb-1 block">Tags (comma separated)</label>
          <input value={form.tags} onChange={e => set('tags', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="production, coding" />
        </div>

        <div>
          <label className="text-zinc-400 text-xs mb-1 block">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 h-20 resize-none" placeholder="Any notes..." />
        </div>

        {mode === 'edit' && (
          <div>
            <label className="text-zinc-400 text-xs mb-1 block">Change Note (for version history)</label>
            <input value={form.changeNote} onChange={e => set('changeNote', e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Why are you changing this?" />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium transition">
            {mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

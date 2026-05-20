import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function ApplicationsPanel() {
    const [apps, setApps] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', roleId: '' });

    async function load() {
        setLoading(true);
        setError('');
        try {
            const [appsRes, rolesRes] = await Promise.all([
                api('/api/admin/apps'),
                api('/api/admin/roles'),
            ]);
            setApps(appsRes);
            setRoles(rolesRes);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function openCreate() {
        setForm({ name: '', description: '', roleId: roles[0]?.id ?? '' });
        setShowCreate(true);
    }
    function closeCreate() { setShowCreate(false); }

    async function createApp(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await api('/api/admin/apps', {
                method: 'POST',
                body: {
                    name: form.name.trim(),
                    description: form.description.trim(),
                    roleId: Number(form.roleId),
                },
            });
            setShowCreate(false);
            await load();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteApp(id) {
        if (!window.confirm('Supprimer cette application ?')) return;
        try {
            await api(`/api/admin/apps/${id}`, { method: 'DELETE' });
            await load();
        } catch (e) {
            setError(e.message);
        }
    }

    return (
        <div className="management-content">
            <div className="content-header">
                <h2>Applications</h2>
                <button className="btn-primary" onClick={openCreate}>
                    <span>＋</span> Nouvelle application
                </button>
            </div>

            {error && (
                <div style={{
                    border: '1px solid #ef4444', color: '#fecaca',
                    background: 'rgba(239,68,68,.1)', padding: 12, borderRadius: 12, marginBottom: 16
                }}>
                    {error}
                </div>
            )}

            {loading ? (
                <div className="card-base skeleton" style={{ height: 120 }} />
            ) : apps.length === 0 ? (
                <div className="card-base" style={{ opacity: .8 }}>
                    Aucune application.
                </div>
            ) : (
                <div className="apps-grid">
                    {apps.map(app => (
                        <div key={app.id} className="app-card">
                            <div className="app-header">
                                <h3>{app.name}</h3>
                            </div>
                            <p>{app.description || '—'}</p>
                            <div className="app-actions">
                                <span className="badge-primary">{app.role?.name || '—'}</span>
                                <button className="btn-danger" onClick={() => deleteApp(app.id)}>Supprimer</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal création */}
            {showCreate && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                }}>
                    <div className="card-base" style={{ width: 520, background: 'rgba(26,31,46,.95)' }}>
                        <h3 style={{ marginBottom: 16 }}>Nouvelle application</h3>
                        <form onSubmit={createApp} className="flex flex-col gap-4">
                            <div>
                                <label className="text-sm">Nom</label>
                                <input
                                    className="search-bar" style={{ margin: 0, maxWidth: '100%' }}
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ex: CRM"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm">Description</label>
                                <textarea
                                    className="search-bar" style={{ margin: 0, maxWidth: '100%', height: 96 }}
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Optionnel"
                                />
                            </div>
                            <div>
                                <label className="text-sm">Rôle requis</label>
                                <select
                                    className="search-bar" style={{ margin: 0, maxWidth: '100%' }}
                                    value={form.roleId}
                                    onChange={e => setForm({ ...form, roleId: e.target.value })}
                                    required
                                >
                                    <option value="" disabled>Choisir un rôle…</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-between" style={{ marginTop: 8 }}>
                                <button type="button" className="btn-secondary" onClick={closeCreate}>
                                    Annuler
                                </button>
                                <button className="btn-primary" disabled={saving}>
                                    {saving ? 'Création…' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

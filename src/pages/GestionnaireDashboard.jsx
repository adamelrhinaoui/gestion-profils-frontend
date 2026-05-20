// src/pages/GestionnaireDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./dashboard.css";

const API_GEST = "http://localhost:8080/api/gestionnaire";
const HIDDEN_ROLE = "ROLE_USER";

/* ================= helpers ================= */
const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("jwt") ||
    "";

async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        const e = new Error(`HTTP ${res.status} ${res.statusText}`);
        e.status = res.status;
        e.responseText = t;
        throw e;
    }
    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
}

/* ================= UI mini composants ================= */
function ErrorBanner({ error, onClose }) {
    if (!error) return null;
    const msg =
        typeof error === "string"
            ? error
            : error.responseText
                ? `${error.message}\n${error.responseText}`
                : error.message || "Erreur inconnue";
    return (
        <div
            className="card-base"
            style={{
                borderColor: "#ef4444",
                color: "#fee2e2",
                background: "rgba(185,28,28,.12)",
                marginBottom: 16,
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg}</pre>
                <button className="btn-action delete" onClick={onClose}>✕</button>
            </div>
        </div>
    );
}

function Toast({ toast, onClose }) {
    if (!toast) return null;
    const isOk = toast.type === "success";
    return (
        <div
            className="card-base"
            style={{
                borderColor: isOk ? "#10b981" : "#ef4444",
                background: isOk ? "rgba(16,185,129,.12)" : "rgba(185,28,28,.12)",
                color: isOk ? "#d1fae5" : "#fee2e2",
                marginBottom: 16,
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 600 }}>{toast.text}</div>
                <button className="btn-action delete" onClick={onClose}>✕</button>
            </div>
        </div>
    );
}

/* ===== pager ===== */
function buildPageWindow(total, pageSize, current, windowSize = 5) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const out = [];
    if (pages <= windowSize + 2) {
        for (let p = 1; p <= pages; p++) out.push(p);
        return out;
    }
    const half = Math.floor(windowSize / 2);
    let start = Math.max(2, current - half);
    let end = Math.min(pages - 1, current + half);
    if (current <= half + 2) {
        start = 2; end = 1 + windowSize;
    } else if (current >= pages - (half + 1)) {
        start = pages - windowSize; end = pages - 1;
    }
    out.push(1);
    if (start > 2) out.push("…");
    for (let p = start; p <= end; p++) out.push(p);
    if (end < pages - 1) out.push("…");
    out.push(pages);
    return out;
}

function Pager({ total, page, pageSize, onPage }) {
    const items = buildPageWindow(total, pageSize, page, 5);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return null;

    const baseBtn = {
        padding: "4px 10px",
        fontSize: 12,
        borderRadius: 8,
        border: "1px solid #4b5563",
        background: "#1f2937",
        color: "#e5e7eb",
    };
    const activeBtn = { ...baseBtn, background: "#5b21b6", borderColor: "#7c3aed" };
    const ghostBtn  = { ...baseBtn, opacity: 0.9 };

    return (
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "8px 0 12px" }}>
            <button style={ghostBtn} disabled={page <= 1} onClick={() => onPage(1)}>«</button>
            <button style={ghostBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
            {items.map((it, idx) =>
                it === "…" ? (
                    <span key={`dots-${idx}`} style={{ padding: "0 6px", opacity: 0.7 }}>…</span>
                ) : (
                    <button key={`p-${it}`} onClick={() => onPage(it)} style={it === page ? activeBtn : baseBtn}>
                        {it}
                    </button>
                )
            )}
            <button style={ghostBtn} disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
            <button style={ghostBtn} disabled={page >= pages} onClick={() => onPage(pages)}>»</button>
        </div>
    );
}

/* ================= main page ================= */
export default function GestionnaireDashboard() {
    const [tab, setTab] = useState("assign");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]); // union des rôles de MES apps (backend)
    const [apps, setApps]   = useState([]); // MES apps (backend)

    // sélection
    const [selectedUserId, setSelectedUserId] = useState("");
    const [selectedAppIds, setSelectedAppIds] = useState([]); // multi
    const [selectedRoles, setSelectedRoles]   = useState(new Set()); // Set<string roleId>

    // pagination
    const PAGE_SIZE = 8;
    const [pageUsers, setPageUsers] = useState(1);
    const [pageRoles, setPageRoles] = useState(1);
    const [pageApps,  setPageApps]  = useState(1);

    async function loadAll() {
        setLoading(true);
        setError("");
        try {
            const [u, r, a] = await Promise.all([
                fetchJSON(`${API_GEST}/users`),
                fetchJSON(`${API_GEST}/roles`),
                fetchJSON(`${API_GEST}/apps`),
            ]);
            setUsers(u || []);
            setRoles((r || []).filter((x) => x.name !== HIDDEN_ROLE)); // cache ROLE_USER
            setApps(a || []);
            if ((a || []).length && selectedAppIds.length === 0) setSelectedAppIds([a[0].id]);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadAll(); }, []);

    const selectedUser =
        users.find((u) => String(u.id) === String(selectedUserId)) || null;

    // rôles visibles = union des rôles des apps cochées (hors ROLE_USER)
    const visibleRoles = useMemo(() => {
        const chosen = selectedAppIds.length > 0
            ? apps.filter((a) => selectedAppIds.includes(a.id))
            : apps;
        const map = new Map();
        chosen.forEach((a) =>
            (a.roles || []).forEach((r) => { if (r.name !== HIDDEN_ROLE) map.set(r.id, r); })
        );
        return Array.from(map.values());
    }, [apps, selectedAppIds]);

    // Quand on change d’utilisateur → préremplir (hors ROLE_USER)
    useEffect(() => {
        if (!selectedUser) { setSelectedRoles(new Set()); return; }
        const roleIds = new Set(
            (selectedUser.roles || []).filter((r) => r.name !== HIDDEN_ROLE).map((r) => String(r.id))
        );
        setSelectedRoles(roleIds);
    }, [selectedUser]);

    // Si on change les apps cochées → nettoyer les rôles non visibles
    useEffect(() => {
        setSelectedRoles((prev) => {
            const allowed = new Set(visibleRoles.map((r) => String(r.id)));
            const next = new Set();
            prev.forEach((id) => { if (allowed.has(id)) next.add(id); });
            return next;
        });
    }, [visibleRoles]);

    function toggleRole(roleId) {
        setSelectedRoles((prev) => {
            const next = new Set(prev);
            const k = String(roleId);
            if (next.has(k)) next.delete(k); else next.add(k);
            return next;
        });
    }

    // ===== users detail modal =====
    const [openDetail, setOpenDetail] = useState(false);
    const [detailUser, setDetailUser] = useState(null);
    function openUserDetail(u) {
        setDetailUser(u);
        setOpenDetail(true);
    }

    // Apps du user (intersection rôles user × rôles app)
    const detailApps = useMemo(() => {
        if (!detailUser) return [];
        const userRoleIds = new Set(
            (detailUser.roles || []).filter((r) => r.name !== HIDDEN_ROLE).map((r) => r.id)
        );
        return apps
            .map((a) => {
                const appRoles = (a.roles || []).filter(
                    (r) => r.name !== HIDDEN_ROLE && userRoleIds.has(r.id)
                );
                return appRoles.length ? { ...a, _roles: appRoles } : null;
            })
            .filter(Boolean);
    }, [detailUser, apps]);

    async function applyAssignments() {
        if (!selectedUser) return;
        const uid = selectedUser.id;

        const current = new Set(
            (selectedUser.roles || [])
                .filter((r) => r.name !== HIDDEN_ROLE)
                .map((r) => String(r.id))
        );
        const allowed = new Set(visibleRoles.map((r) => String(r.id)));

        const toAdd = [...selectedRoles].filter((id) => allowed.has(id) && !current.has(id));
        const toRemove = [...current].filter((id) => allowed.has(id) && !selectedRoles.has(id));

        try {
            setLoading(true);
            const singleAppId = selectedAppIds.length === 1 ? Number(selectedAppIds[0]) : null;

            for (const rid of toAdd) {
                const url = singleAppId
                    ? `${API_GEST}/users/${uid}/roles/${rid}?appId=${singleAppId}`
                    : `${API_GEST}/users/${uid}/roles/${rid}`;
                await fetchJSON(url, { method: "POST" });
            }
            for (const rid of toRemove) {
                const url = singleAppId
                    ? `${API_GEST}/users/${uid}/roles/${rid}?appId=${singleAppId}`
                    : `${API_GEST}/users/${uid}/roles/${rid}`;
                await fetchJSON(url, { method: "DELETE" });
            }
            await loadAll();
            setSelectedUserId(String(uid));
            setToast({ type: "success", text: "Attributions appliquées avec succès." });
            setTimeout(() => setToast(null), 2500);
        } catch (e) {
            setError(e);
            setToast({ type: "error", text: "Échec de l’attribution." });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setLoading(false);
        }
    }

    // pagination vues
    const pagedUsers = useMemo(() => {
        const from = (pageUsers - 1) * PAGE_SIZE;
        return users.slice(from, from + PAGE_SIZE);
    }, [users, pageUsers]);

    const filteredRoles = useMemo(
        () => [...visibleRoles].sort((a, b) => String(a.name).localeCompare(b.name)),
        [visibleRoles]
    );
    const pagedRoles = useMemo(() => {
        const from = (pageRoles - 1) * PAGE_SIZE;
        return filteredRoles.slice(from, from + PAGE_SIZE);
    }, [filteredRoles, pageRoles]);

    const pagedApps = useMemo(() => {
        const from = (pageApps - 1) * PAGE_SIZE;
        return apps.slice(from, from + PAGE_SIZE);
    }, [apps, pageApps]);

    return (
        <div className="admin-dashboard">
            <aside className="sidebar open">
                <div className="sidebar-header">
                    <div className="logo">🛠️ Gestionnaire</div>
                </div>
                <nav className="sidebar-nav">
                    <button className={`nav-item ${tab === "assign" ? "active" : ""}`} onClick={() => setTab("assign")}>🎯 Attributions</button>
                    <button className={`nav-item ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>👥 Utilisateurs</button>
                    <button className={`nav-item ${tab === "roles" ? "active" : ""}`} onClick={() => setTab("roles")}>🛡️ Rôles</button>
                    <button className={`nav-item ${tab === "apps" ? "active" : ""}`} onClick={() => setTab("apps")}>⚙️ Applications</button>
                </nav>
                <div className="sidebar-footer">
                    <button
                        className="nav-item logout"
                        onClick={() => {
                            localStorage.clear();
                            window.location.href = "/login";
                        }}
                    >
                        Déconnexion
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="main-header">
                    <div className="header-left"><h1>Dashboard gestionnaire</h1></div>
                </header>

                <section className="main-body">
                    <Toast toast={toast} onClose={() => setToast(null)} />
                    <ErrorBanner error={error} onClose={() => setError("")} />

                    {loading ? (
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span className="loading" /> Chargement…
                        </div>
                    ) : (
                        <>
                            {/* ===== ATTRIBUTIONS ===== */}
                            {tab === "assign" && (
                                <div className="management-content">
                                    <div className="content-header">
                                        <h2>Attribuer des rôles aux utilisateurs (par app)</h2>
                                    </div>

                                    <div className="grid-auto-fit" style={{ gap: 16 }}>
                                        {/* user select */}
                                        <div className="card-base">
                                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Utilisateur</div>
                                            <select
                                                value={selectedUserId}
                                                onChange={(e) => setSelectedUserId(e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    padding: 12,
                                                    borderRadius: 10,
                                                    background: "rgba(26,31,46,.8)",
                                                    color: "white",
                                                    border: "1px solid #334155",
                                                }}
                                            >
                                                <option value="">— choisir —</option>
                                                {users.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.username} (#{u.id})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* apps multi */}
                                        <div className="card-base">
                                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Applications (multi)</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {apps.map((a) => {
                                                    const active = selectedAppIds.includes(a.id);
                                                    return (
                                                        <label
                                                            key={`app-chip-${a.id}`}
                                                            className="badge-primary"
                                                            style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                                                            title={a.description || ""}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={active}
                                                                onChange={(e) => {
                                                                    setSelectedAppIds((prev) => {
                                                                        const set = new Set(prev);
                                                                        if (e.target.checked) set.add(a.id);
                                                                        else set.delete(a.id);
                                                                        return Array.from(set);
                                                                    });
                                                                }}
                                                                style={{ accentColor: "#6366f1" }}
                                                            />
                                                            {a.name} (#{a.id})
                                                        </label>
                                                    );
                                                })}
                                                {apps.length === 0 && <span className="badge-warning">Aucune application</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* roles area */}
                                    <div className="card-base" style={{ marginTop: 16 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Rôles</div>
                                        <div className="roles-tags" style={{ gap: 12 }}>
                                            {visibleRoles.length === 0 && <span className="badge-warning">Aucun rôle</span>}
                                            {visibleRoles.map((r) => {
                                                const checked = selectedRoles.has(String(r.id));
                                                return (
                                                    <label
                                                        key={r.id}
                                                        className="badge-primary"
                                                        style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleRole(r.id)}
                                                            style={{ accentColor: "#6366f1" }}
                                                        />
                                                        {r.name}
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                                            <button className="btn-primary" onClick={applyAssignments} disabled={!selectedUser}>
                                                Appliquer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ===== USERS ===== */}
                            {tab === "users" && (
                                <div className="management-content">
                                    <div className="content-header"><h2>Utilisateurs</h2></div>

                                    <Pager total={users.length} page={pageUsers} pageSize={PAGE_SIZE} onPage={setPageUsers} />

                                    <div className="data-table">
                                        <table>
                                            <thead>
                                            <tr>
                                                <th style={{ width: 100 }}>ID</th>
                                                <th>USERNAME</th>
                                                <th style={{ width: 360 }}>RÔLES</th>
                                                <th style={{ width: 220 }}>ACTIONS</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {pagedUsers.map((u) => (
                                                <tr key={u.id}>
                                                    <td>{u.id}</td>
                                                    <td>{u.username}</td>
                                                    <td>
                                                        <div className="roles-tags">
                                                            {(u.roles || [])
                                                                .filter((r) => r.name !== HIDDEN_ROLE)
                                                                .map((r) => (
                                                                    <span className="role-tag" key={`${u.id}-${r.id}`}>{r.name}</span>
                                                                ))}
                                                            {(u.roles || []).filter((r) => r.name !== HIDDEN_ROLE).length === 0 && (
                                                                <span className="badge-warning">Aucun</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                className="btn-secondary"
                                                                onClick={() => { setSelectedUserId(String(u.id)); setTab("assign"); }}
                                                            >
                                                                Modifier
                                                            </button>
                                                            <button className="btn-secondary" onClick={() => openUserDetail(u)}>
                                                                Détails
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {pagedUsers.length === 0 && (
                                                <tr><td colSpan={4} style={{ opacity: 0.8, padding: 24 }}>Aucun utilisateur.</td></tr>
                                            )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <Pager total={users.length} page={pageUsers} pageSize={PAGE_SIZE} onPage={setPageUsers} />
                                </div>
                            )}

                            {/* ===== ROLES ===== */}
                            {tab === "roles" && (
                                <div className="management-content">
                                    <div className="content-header"><h2>Rôles (rattachés à vos apps)</h2></div>

                                    <Pager total={filteredRoles.length} page={pageRoles} pageSize={PAGE_SIZE} onPage={setPageRoles} />

                                    <div className="roles-grid">
                                        {pagedRoles.map((r) => (
                                            <div key={r.id} className="role-card">
                                                <div className="role-header"><span>🛡️</span><h3>{r.name}</h3></div>
                                                <p>Identifiant : {r.id}</p>
                                            </div>
                                        ))}
                                        {filteredRoles.length === 0 && (
                                            <div className="card-base" style={{ opacity: .8 }}>Aucun rôle</div>
                                        )}
                                    </div>

                                    <Pager total={filteredRoles.length} page={pageRoles} pageSize={PAGE_SIZE} onPage={setPageRoles} />
                                </div>
                            )}

                            {/* ===== APPS ===== */}
                            {tab === "apps" && (
                                <div className="management-content">
                                    <div className="content-header"><h2>Applications (que vous gérez)</h2></div>

                                    <Pager total={apps.length} page={pageApps} pageSize={PAGE_SIZE} onPage={setPageApps} />

                                    <div className="apps-grid">
                                        {pagedApps.map((a) => (
                                            <div key={a.id} className="app-card">
                                                <div className="app-header"><span>⚙️</span><h3>{a.name}</h3></div>
                                                <p>{a.description || "—"}</p>
                                                <div className="roles-tags" style={{ marginTop: 8 }}>
                                                    {(a.roles || []).filter((r) => r.name !== HIDDEN_ROLE).map((r) => (
                                                        <span className="role-tag" key={`app-${a.id}-${r.id}`}>{r.name}</span>
                                                    ))}
                                                    {(a.roles || []).filter((r) => r.name !== HIDDEN_ROLE).length === 0 && (
                                                        <span className="badge-warning">Aucun rôle</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {apps.length === 0 && <div className="card-base" style={{ opacity: .8 }}>Aucune application</div>}
                                    </div>

                                    <Pager total={apps.length} page={pageApps} pageSize={PAGE_SIZE} onPage={setPageApps} />
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>

            {/* ===== MODAL DÉTAIL UTILISATEUR ===== */}
            {openDetail && detailUser && (
                <div
                    className="fixed"
                    style={{
                        inset: 0,
                        background: "rgba(0,0,0,.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000,
                        padding: 12,
                    }}
                >
                    <div
                        className="card-base"
                        style={{
                            width: "min(880px, 96vw)",
                            background: "#111827",
                            borderColor: "#374151",
                        }}
                    >
                        <div className="content-header" style={{ marginBottom: 12 }}>
                            <h2 style={{ margin: 0 }}>Détails : {detailUser.username}</h2>
                            <button className="btn-action delete" onClick={() => setOpenDetail(false)} />
                        </div>

                        {/* Corps scrollable et compact */}
                        <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
                            <div className="grid-auto-fit" style={{ gap: 16 }}>
                                {/* identité */}
                                <div className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Identité</div>
                                    <div className="roles-tags">
                                        <span className="role-tag">ID: {detailUser.id}</span>
                                        <span className="role-tag">{detailUser.username}</span>
                                    </div>
                                </div>

                                {/* rôles actuels */}
                                <div className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Rôles actuels (hors {HIDDEN_ROLE})</div>
                                    <div className="roles-tags">
                                        {(detailUser.roles || [])
                                            .filter((r) => r.name !== HIDDEN_ROLE)
                                            .map((r) => <span key={`ru-${r.id}`} className="role-tag">{r.name}</span>)}
                                        {(detailUser.roles || []).filter((r) => r.name !== HIDDEN_ROLE).length === 0 &&
                                            <span className="badge-warning">Aucun</span>}
                                    </div>
                                </div>

                                {/* apps + rôles du user : COMPACT GRID */}
                                <div className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                        Applications du user (avec les rôles qu’il possède)
                                    </div>

                                    {detailApps.length === 0 ? (
                                        <div className="badge-warning">Aucune application</div>
                                    ) : (
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                                                gap: 12,
                                            }}
                                        >
                                            {detailApps.map((a) => (
                                                <div key={`du-app-${a.id}`} className="card-base" style={{ padding: 12 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                                        <span>⚙️</span>
                                                        <strong>{a.name}</strong>
                                                    </div>
                                                    <div className="text-sm" style={{ opacity: .75, marginBottom: 8 }}>
                                                        {a.description || "—"}
                                                    </div>
                                                    <div className="roles-tags">
                                                        {(a._roles || []).map((r) => (
                                                            <span className="role-tag" key={`du-app-${a.id}-${r.id}`}>{r.name}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

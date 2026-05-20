// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./dashboard.css";

/* ================== CONFIG ================== */
const API = "http://localhost:8080/api/admin";
const HIDE_ROLES = new Set(["ROLE_USER"]); // masqué côté UI

const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("jwt") ||
    "";

/* ---- fetch JSON helper ---- */
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

    const ct = res.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");

    if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        const err = new Error(`HTTP ${res.status} – ${res.statusText}`);
        err.status = res.status;
        err.responseText = bodyText;
        throw err;
    }

    if (res.status === 204) return null;
    return isJson ? res.json() : res.text();
}

/* ================== mini UI ================== */
function ErrorBanner({ error, onClose }) {
    if (!error) return null;

    let friendly = "";
    if (error.status === 401) friendly = "Non authentifié : reconnecte-toi (JWT manquant/invalide).";
    else if (error.status === 403)
        friendly = "Accès refusé : il faut le rôle ADMIN et une config sécurité correcte.";
    else if (error.status === 409) friendly = "Conflit : rôle protégé ou déjà utilisé.";

    const msg =
        (friendly ? friendly + "\n" : "") +
        (error.responseText ? `${error.message}\n${error.responseText}` : error.message);

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
                <button className="btn-action delete" onClick={onClose} title="Fermer">
                    ✕
                </button>
            </div>
        </div>
    );
}

function Modal({ open, title, children, onClose, width = 720, maxBodyHeight = "72vh" }) {
    if (!open) return null;
    return (
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
                    width: `min(${width}px, 96vw)`,
                    background: "#111827",
                    borderColor: "#374151",
                }}
            >
                <div className="content-header" style={{ marginBottom: 12 }}>
                    <h2 style={{ margin: 0 }}>{title}</h2>
                    <button className="btn-action delete" onClick={onClose} title="Fermer" />
                </div>
                <div style={{ maxHeight: maxBodyHeight, overflowY: "auto", paddingRight: 4 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

/* ===== Pagination ===== */
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
        start = 2;
        end = 1 + windowSize;
    } else if (current >= pages - (half + 1)) {
        start = pages - windowSize;
        end = pages - 1;
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
    const ghostBtn = { ...baseBtn, opacity: 0.9 };

    return (
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "8px 0 12px" }}>
            <button style={ghostBtn} disabled={page <= 1} onClick={() => onPage(1)}>
                «
            </button>
            <button style={ghostBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
                ‹
            </button>
            {items.map((it, idx) =>
                    it === "…" ? (
                        <span key={`dots-${idx}`} style={{ padding: "0 6px", opacity: 0.7 }}>
            …
          </span>
                    ) : (
                        <button key={`p-${it}`} onClick={() => onPage(it)} style={it === page ? activeBtn : baseBtn}>
                            {it}
                        </button>
                    )
            )}
            <button style={ghostBtn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
                ›
            </button>
            <button style={ghostBtn} disabled={page >= pages} onClick={() => onPage(pages)}>
                »
            </button>
        </div>
    );
}

/* ================== PAGE ================== */
export default function AdminDashboard() {
    const [tab, setTab] = useState("users");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [apps, setApps] = useState([]);

    // recherche + pagination
    const [qUser, setQUser] = useState("");
    const [qRole, setQRole] = useState("");
    const [qApp, setQApp] = useState("");
    const PAGE = 8;
    const [pageUsers, setPageUsers] = useState(1);
    const [pageRoles, setPageRoles] = useState(1);
    const [pageApps, setPageApps] = useState(1);

    // Rôles CRUD
    const [openRoleModal, setOpenRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleName, setRoleName] = useState("");
    const [openRoleDetail, setOpenRoleDetail] = useState(false);
    const [detailRole, setDetailRole] = useState(null);

    // Apps CRUD
    const [openAppModal, setOpenAppModal] = useState(false);
    const [editingApp, setEditingApp] = useState(null);
    const [appForm, setAppForm] = useState({ name: "", description: "", roleIds: [] });
    const [openAppDetail, setOpenAppDetail] = useState(false);
    const [detailApp, setDetailApp] = useState(null);

    // Attribution gestionnaire
    const [openMgrModal, setOpenMgrModal] = useState(false);
    const [mgrTarget, setMgrTarget] = useState(null);
    const [mgrAppIds, setMgrAppIds] = useState([]);
    const [mgrLoading, setMgrLoading] = useState(false);

    // Détails gestionnaire
    const [openMgrDetail, setOpenMgrDetail] = useState(false);
    const [mgrDetailTarget, setMgrDetailTarget] = useState(null);
    const [mgrDetailApps, setMgrDetailApps] = useState([]);
    const [mgrDetailLoading, setMgrDetailLoading] = useState(false);

    async function loadAll() {
        setLoading(true);
        setError("");
        try {
            const [u, r, a] = await Promise.all([
                fetchJSON(`${API}/users`),
                fetchJSON(`${API}/roles`),
                fetchJSON(`${API}/apps`),
            ]);
            const cleanRoles = (r || []).filter((x) => !HIDE_ROLES.has(x.name));
            const cleanUsers = (u || []).map((uu) => ({
                ...uu,
                roles: (uu.roles || []).filter((x) => !HIDE_ROLES.has(x.name)),
            }));
            const cleanApps = (a || []).map((ap) => ({
                ...ap,
                roles: (ap.roles || []).filter((x) => !HIDE_ROLES.has(x.name)),
            }));
            setUsers(cleanUsers);
            setRoles(cleanRoles);
            setApps(cleanApps);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAll();
    }, []);

    const counts = useMemo(
        () => ({
            users: users.length || 0,
            roles: roles.length || 0,
            apps: apps.length || 0,
            activeUsers: users.length || 0,
        }),
        [users, roles, apps]
    );

    const gestionnaireRole = useMemo(
        () => roles.find((r) => r.name === "ROLE_GESTIONNAIRE") || null,
        [roles]
    );
    const userHasRole = (u, roleName) => (u.roles || []).some((r) => r.name === roleName);

    async function addManagerRoleIfNeeded(u) {
        if (!gestionnaireRole) throw new Error("ROLE_GESTIONNAIRE introuvable");
        if (!userHasRole(u, "ROLE_GESTIONNAIRE")) {
            await fetchJSON(`${API}/users/${u.id}/roles/${gestionnaireRole.id}`, { method: "POST" });
            setUsers((prev) =>
                prev.map((x) =>
                    x.id === u.id ? { ...x, roles: [...(x.roles || []), gestionnaireRole] } : x
                )
            );
        }
    }

    async function removeManager(u) {
        if (!gestionnaireRole) return setError(new Error("ROLE_GESTIONNAIRE introuvable"));
        try {
            await fetchJSON(`${API}/users/${u.id}/roles/${gestionnaireRole.id}`, { method: "DELETE" });
            await fetchJSON(`${API}/users/${u.id}/apps`, {
                method: "PUT",
                body: JSON.stringify({ appIds: [] }),
            }).catch(() => {});
            setUsers((prev) =>
                prev.map((x) =>
                    x.id === u.id
                        ? { ...x, roles: (x.roles || []).filter((r) => r.id !== gestionnaireRole.id) }
                        : x
                )
            );
        } catch (e) {
            setError(e);
        }
    }

    // Ouvrir « Nommer gestionnaire & attribuer des apps »
    async function openManagerModal(u) {
        setError("");
        setMgrTarget(u);
        setMgrAppIds([]);
        setOpenMgrModal(true);
        setMgrLoading(true);
        try {
            const curr = await fetchJSON(`${API}/users/${u.id}/apps`).catch(() => []);
            const ids = Array.isArray(curr)
                ? curr.map((x) => (typeof x === "number" ? x : x?.id)).filter(Boolean)
                : [];
            setMgrAppIds(ids);
        } finally {
            setMgrLoading(false);
        }
    }

    async function saveManagerAndApps() {
        if (!mgrTarget) return;
        setError("");
        setMgrLoading(true);
        try {
            await addManagerRoleIfNeeded(mgrTarget);
            await fetchJSON(`${API}/users/${mgrTarget.id}/apps`, {
                method: "PUT",
                body: JSON.stringify({ appIds: mgrAppIds }),
            }).catch(() => {});
            setOpenMgrModal(false);
            setMgrTarget(null);
            await loadAll();
        } catch (e) {
            setError(e);
        } finally {
            setMgrLoading(false);
        }
    }

    async function openManagerDetails(u) {
        setMgrDetailTarget(u);
        setOpenMgrDetail(true);
        setMgrDetailLoading(true);
        try {
            const list = await fetchJSON(`${API}/users/${u.id}/apps`).catch(() => []);
            let appsList = [];
            if (Array.isArray(list) && list.length) {
                if (typeof list[0] === "number") {
                    appsList = apps.filter((a) => list.includes(a.id));
                } else if (typeof list[0] === "object") {
                    appsList = list;
                }
            }
            appsList = (appsList || []).map((ap) => ({
                ...ap,
                roles: (ap.roles || []).filter((x) => !HIDE_ROLES.has(x.name)),
            }));
            setMgrDetailApps(appsList);
        } finally {
            setMgrDetailLoading(false);
        }
    }

    /* -------- RÔLES -------- */
    function openCreateRole() {
        setEditingRole(null);
        setRoleName("");
        setOpenRoleModal(true);
    }
    function openEditRole(role) {
        setEditingRole(role);
        setRoleName(role?.name || "");
        setOpenRoleModal(true);
    }
    function openDetails(role) {
        setDetailRole(role);
        setOpenRoleDetail(true);
    }

    async function submitRole(e) {
        e.preventDefault();
        setError("");
        const name = roleName.trim();
        if (!name) return setError(new Error("Le nom du rôle est requis."));
        try {
            if (editingRole) {
                const updated = await fetchJSON(`${API}/roles/${editingRole.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ id: editingRole.id, name }),
                });
                setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            } else {
                const created = await fetchJSON(`${API}/roles`, {
                    method: "POST",
                    body: JSON.stringify({ name }),
                });
                if (!HIDE_ROLES.has(created.name)) setRoles((prev) => [created, ...prev]);
            }
            setOpenRoleModal(false);
            setEditingRole(null);
        } catch (e) {
            setError(e);
        }
    }

    async function deleteRole(role) {
        if (!window.confirm(`Supprimer le rôle "${role.name}" ?`)) return;
        setError("");
        try {
            await fetchJSON(`${API}/roles/${role.id}`, { method: "DELETE" });
            setRoles((prev) => prev.filter((r) => r.id !== role.id));
            setUsers((prev) =>
                prev.map((u) => ({ ...u, roles: (u.roles || []).filter((r) => r.id !== role.id) }))
            );
            setApps((prev) =>
                prev.map((a) =>
                    a.roles ? { ...a, roles: (a.roles || []).filter((r) => r.id !== role.id) } : a
                )
            );
        } catch (e) {
            setError(e);
        }
    }

    /* -------- APPS -------- */
    function openCreateApp() {
        setEditingApp(null);
        setAppForm({ name: "", description: "", roleIds: [] });
        setOpenAppModal(true);
    }
    function openEditApp(app) {
        setEditingApp(app);
        setAppForm({
            name: app.name || "",
            description: app.description || "",
            roleIds: (app.roles || []).map((r) => r.id),
        });
        setOpenAppModal(true);
    }
    function openDetailApp(app) {
        setDetailApp(app);
        setOpenAppDetail(true);
    }

    async function submitApp(e) {
        e.preventDefault();
        setError("");
        const payload = {
            name: (appForm.name || "").trim(),
            description: appForm.description?.trim() || "",
            roleIds: appForm.roleIds || [],
        };
        if (!payload.name) return setError(new Error("Le nom de l’application est requis."));
        if (!payload.roleIds.length)
            return setError(new Error("Sélectionne au moins un rôle pour l’application."));

        try {
            if (editingApp) {
                const updated = await fetchJSON(`${API}/apps/${editingApp.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                updated.roles = (updated.roles || []).filter((x) => !HIDE_ROLES.has(x.name));
                setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            } else {
                const created = await fetchJSON(`${API}/apps`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                created.roles = (created.roles || []).filter((x) => !HIDE_ROLES.has(x.name));
                setApps((prev) => [created, ...prev]);
            }
            setOpenAppModal(false);
            setEditingApp(null);
        } catch (e) {
            setError(e);
        }
    }

    async function deleteApp(app) {
        if (!window.confirm(`Supprimer l’application "${app.name}" ?`)) return;
        setError("");
        try {
            await fetchJSON(`${API}/apps/${app.id}`, { method: "DELETE" });
            setApps((prev) => prev.filter((a) => a.id !== app.id));
        } catch (e) {
            setError(e);
        }
    }

    /* -------- Filtres + pagination -------- */
    const filteredUsers = useMemo(() => {
        const q = qUser.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                String(u.id).includes(q) ||
                (u.username || "").toLowerCase().includes(q) ||
                (Array.isArray(u.roles)
                    ? u.roles.some((r) => (r.name || "").toLowerCase().includes(q))
                    : false)
        );
    }, [users, qUser]);

    const filteredRoles = useMemo(() => {
        const q = qRole.trim().toLowerCase();
        if (!q) return roles;
        return roles.filter((r) => String(r.id).includes(q) || (r.name || "").toLowerCase().includes(q));
    }, [roles, qRole]);

    const filteredApps = useMemo(() => {
        const q = qApp.trim().toLowerCase();
        if (!q) return apps;
        return apps.filter(
            (a) =>
                String(a.id).includes(q) ||
                (a.name || "").toLowerCase().includes(q) ||
                (a.description || "").toLowerCase().includes(q) ||
                (a.roles || []).some((r) => (r.name || "").toLowerCase().includes(q))
        );
    }, [apps, qApp]);

    const pagedUsers = useMemo(() => {
        const from = (pageUsers - 1) * PAGE;
        return filteredUsers.slice(from, from + PAGE);
    }, [filteredUsers, pageUsers]);

    const pagedRoles = useMemo(() => {
        const from = (pageRoles - 1) * PAGE;
        return filteredRoles.slice(from, from + PAGE);
    }, [filteredRoles, pageRoles]);

    const pagedApps = useMemo(() => {
        const from = (pageApps - 1) * PAGE;
        return filteredApps.slice(from, from + PAGE);
    }, [filteredApps, pageApps]);

    /* =================== RENDER =================== */
    return (
        <div className="admin-dashboard">
            {/* SIDEBAR */}
            <aside className="sidebar open">
                <div className="sidebar-header">
                    <div className="logo">🛡️ Admin </div>
                </div>
                <nav className="sidebar-nav">
                    <button className={`nav-item ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
                        🏠 Tableau de bord
                    </button>
                    <button className={`nav-item ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
                        👥 Utilisateurs
                    </button>
                    <button className={`nav-item ${tab === "roles" ? "active" : ""}`} onClick={() => setTab("roles")}>
                        🛡️ Rôles
                    </button>
                    <button className={`nav-item ${tab === "apps" ? "active" : ""}`} onClick={() => setTab("apps")}>
                        ⚙️ Applications
                    </button>

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

            {/* CONTENU */}
            <main className="main-content">
                <header className="main-header">
                    <div className="header-left">
                        <h1>Tableau de bord administrateur</h1>
                    </div>
                    <div className="header-right">
                        <div className="user-profile">
                            <span>A</span>
                            <span>Admin</span>
                        </div>
                    </div>
                </header>

                <section className="main-body">
                    <ErrorBanner error={error} onClose={() => setError("")} />
                    {loading ? (
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span className="loading" /> Chargement…
                        </div>
                    ) : (
                        <>
                            {/* DASHBOARD */}
                            {tab === "dashboard" && (
                                <div className="dashboard-content">
                                    <div className="stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-icon users">👥</div>
                                            <div className="stat-info">
                                                <h3>{counts.users}</h3>
                                                <p>UTILISATEURS</p>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon roles">🛡️</div>
                                            <div className="stat-info">
                                                <h3>{counts.roles}</h3>
                                                <p>RÔLES</p>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon apps">⚙️</div>
                                            <div className="stat-info">
                                                <h3>{counts.apps}</h3>
                                                <p>APPLICATIONS</p>
                                            </div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-icon active">✅</div>
                                            <div className="stat-info">
                                                <h3>{counts.activeUsers}</h3>
                                                <p>UTILISATEURS ACTIFS</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 16 }}>
                                        <button className="btn-secondary" onClick={loadAll}>
                                            Rafraîchir
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* USERS */}
                            {tab === "users" && (
                                <div className="management-content">
                                    <div className="content-header">
                                        <h2>Utilisateurs</h2>
                                    </div>

                                    <div className="search-bar">
                                        <input
                                            placeholder="Rechercher par username/role…"
                                            value={qUser}
                                            onChange={(e) => {
                                                setQUser(e.target.value);
                                                setPageUsers(1);
                                            }}
                                        />
                                    </div>

                                    <Pager total={filteredUsers.length} page={pageUsers} pageSize={PAGE} onPage={setPageUsers} />

                                    <div className="data-table">
                                        <table>
                                            <thead>
                                            <tr>
                                                <th style={{ width: 100 }}>ID</th>
                                                <th>USERNAME</th>
                                                <th style={{ width: 380 }}>RÔLES</th>
                                                <th style={{ width: 420 }}>Gestionnaire</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {pagedUsers.map((u) => {
                                                const isManager = userHasRole(u, "ROLE_GESTIONNAIRE");
                                                return (
                                                    <tr key={`user-${u.id}`}>
                                                        <td>{u.id}</td>
                                                        <td>{u.username}</td>
                                                        <td>
                                                            <div className="roles-tags">
                                                                {(u.roles || []).map((r, idx) => (
                                                                    <span className="role-tag" key={`u${u.id}-r${r?.id ?? "none"}-${idx}`}>
                                      {r.name}
                                    </span>
                                                                ))}
                                                                {(u.roles || []).length === 0 && <span className="badge-warning">Aucun</span>}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {isManager ? (
                                                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                                                    <span className="badge-success">Gestionnaire ✅</span>
                                                                    <button className="btn-secondary" onClick={() => openManagerModal(u)}>
                                                                        Attribuer des apps
                                                                    </button>
                                                                    <button className="btn-secondary" onClick={() => openManagerDetails(u)}>
                                                                        Détails
                                                                    </button>
                                                                    <button className="btn-danger" onClick={() => removeManager(u)}>
                                                                        Retirer
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button className="btn-secondary" onClick={() => openManagerModal(u)}>
                                                                    Nommer gestionnaire
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {pagedUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} style={{ opacity: 0.8, padding: 24 }}>
                                                        Aucun utilisateur.
                                                    </td>
                                                </tr>
                                            )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <Pager total={filteredUsers.length} page={pageUsers} pageSize={PAGE} onPage={setPageUsers} />
                                </div>
                            )}

                            {/* ROLES */}
                            {tab === "roles" && (
                                <div className="management-content">
                                    <div className="content-header">
                                        <h2>Rôles</h2>
                                        <button className="btn-primary" onClick={openCreateRole}>
                                            ＋ Nouveau rôle
                                        </button>
                                    </div>

                                    <div className="search-bar">
                                        <input
                                            placeholder="Rechercher un rôle…"
                                            value={qRole}
                                            onChange={(e) => {
                                                setQRole(e.target.value);
                                                setPageRoles(1);
                                            }}
                                        />
                                    </div>

                                    <Pager total={filteredRoles.length} page={pageRoles} pageSize={PAGE} onPage={setPageRoles} />

                                    {filteredRoles.length === 0 ? (
                                        <div className="card-base" style={{ opacity: 0.8 }}>
                                            Aucun rôle.
                                        </div>
                                    ) : (
                                        <div className="roles-grid">
                                            {pagedRoles.map((r) => (
                                                <div key={`role-${r.id}`} className="role-card">
                                                    <div className="role-header">
                                                        <span>🛡️</span>
                                                        <h3>{r.name}</h3>
                                                    </div>
                                                    <p>Identifiant : {r.id}</p>
                                                    <div className="role-actions" style={{ display: "flex", gap: 8 }}>
                                                        <button type="button" className="btn-secondary" onClick={() => openEditRole(r)}>
                                                            Modifier
                                                        </button>
                                                        <button type="button" className="btn-danger" onClick={() => deleteRole(r)}>
                                                            Supprimer
                                                        </button>
                                                        <button type="button" className="btn-secondary" onClick={() => openDetails(r)}>
                                                            Détails
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Pager total={filteredRoles.length} page={pageRoles} pageSize={PAGE} onPage={setPageRoles} />
                                </div>
                            )}

                            {/* APPS */}
                            {tab === "apps" && (
                                <div className="management-content">
                                    <div className="content-header">
                                        <h2>Applications</h2>
                                        <button className="btn-primary" onClick={openCreateApp}>
                                            ＋ Nouvelle application
                                        </button>
                                    </div>

                                    <div className="search-bar">
                                        <input
                                            placeholder="Rechercher une application…"
                                            value={qApp}
                                            onChange={(e) => {
                                                setQApp(e.target.value);
                                                setPageApps(1);
                                            }}
                                        />
                                    </div>

                                    <Pager total={filteredApps.length} page={pageApps} pageSize={PAGE} onPage={setPageApps} />

                                    {apps.length === 0 ? (
                                        <div className="card-base" style={{ opacity: 0.8 }}>
                                            Aucune application.
                                        </div>
                                    ) : (
                                        <div className="apps-grid">
                                            {pagedApps.map((app) => (
                                                <div key={`app-${app.id}`} className="app-card">
                                                    <div className="app-header">
                                                        <span>⚙️</span>
                                                        <h3>{app.name}</h3>
                                                    </div>
                                                    <p>{app.description || "—"}</p>
                                                    <div style={{ marginBottom: 12 }}>
                                                        <div className="roles-tags">
                                                            {(app.roles || []).map((r) => (
                                                                <span className="role-tag" key={`app-${app.id}-role-${r.id}`}>
                                  {r.name}
                                </span>
                                                            ))}
                                                            {(app.roles || []).length === 0 && (
                                                                <span className="badge-warning">Aucun rôle</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="app-actions" style={{ display: "flex", gap: 8 }}>
                                                        <button className="btn-secondary" onClick={() => openEditApp(app)}>
                                                            Modifier
                                                        </button>
                                                        <button className="btn-danger" onClick={() => deleteApp(app)}>
                                                            Supprimer
                                                        </button>
                                                        <button className="btn-secondary" onClick={() => openDetailApp(app)}>
                                                            Détails
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Pager total={filteredApps.length} page={pageApps} pageSize={PAGE} onPage={setPageApps} />
                                </div>
                            )}

                            {/* STATS */}
                            {tab === "stats" && (
                                <div className="management-content">
                                    <div className="content-header">
                                        <h2>Statistiques</h2>
                                    </div>
                                    <div className="card-base">À brancher plus tard.</div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>

            {/* MODAL RÔLE (create/update) */}
            <Modal
                open={openRoleModal}
                title={editingRole ? "Modifier le rôle" : "Nouveau rôle"}
                onClose={() => setOpenRoleModal(false)}
            >
                <form onSubmit={submitRole} className="grid-auto-fit" style={{ gap: 16 }}>
                    <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Nom du rôle</div>
                        <input
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            placeholder="ROLE_XYZ"
                            style={{
                                width: "100%",
                                padding: 12,
                                borderRadius: 10,
                                background: "#111827",
                                color: "white",
                                border: "1px solid #374151", // <-- corrige
                            }}
                        />
                    </label>
                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button type="button" className="btn-secondary" onClick={() => setOpenRoleModal(false)}>
                            Annuler
                        </button>
                        <button className="btn-primary" type="submit">
                            {editingRole ? "Enregistrer" : "Créer"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL RÔLE (détails) */}
            <Modal open={openRoleDetail} title="Détail du rôle" onClose={() => setOpenRoleDetail(false)}>
                {detailRole && (
                    <div className="grid-auto-fit" style={{ gap: 16 }}>
                        <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Identifiant</div>
                            <input
                                disabled
                                value={detailRole.id}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 10,
                                    background: "#111827",
                                    color: "white",
                                    border: "1px solid #374151", // <-- corrige
                                }}
                            />
                        </label>
                        <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Nom</div>
                            <input
                                disabled
                                value={detailRole.name || ""}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 10,
                                    background: "#111827",
                                    color: "white",
                                    border: "1px solid #374151", // <-- corrige
                                }}
                            />
                        </label>
                        <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Utilisateurs qui possèdent ce rôle</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {users
                                    .filter((u) => (u.roles || []).some((r) => r.id === detailRole.id))
                                    .map((u) => (
                                        <span className="role-tag" key={`holder-${u.id}`}>
                      {u.username}
                    </span>
                                    ))}
                                {users.filter((u) => (u.roles || []).some((r) => r.id === detailRole.id)).length === 0 && (
                                    <span className="badge-warning">0</span>
                                )}
                            </div>
                        </label>
                    </div>
                )}
            </Modal>

            {/* MODAL APP (create/update) */}
            <Modal
                open={openAppModal}
                title={editingApp ? "Modifier l’application" : "Nouvelle application"}
                onClose={() => {
                    setOpenAppModal(false);
                    setEditingApp(null);
                }}
                width={760}
            >
                <form onSubmit={submitApp} className="grid-auto-fit" style={{ gap: 16 }}>
                    <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Nom</div>
                        <input
                            value={appForm.name}
                            onChange={(e) => setAppForm((s) => ({ ...s, name: e.target.value }))}
                            placeholder="Portail RH"
                            style={{
                                width: "100%",
                                padding: 12,
                                borderRadius: 10,
                                background: "#111827",
                                color: "white",
                                border: "1px solid #374151", // <-- corrige
                            }}
                        />
                    </label>

                    <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Rôles associés (obligatoire)</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {roles.map((r) => {
                                const active = appForm.roleIds.includes(r.id);
                                return (
                                    <label key={`sel-role-${r.id}`} className="role-tag" style={{ cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={(e) => {
                                                setAppForm((s) => {
                                                    const set = new Set(s.roleIds);
                                                    if (e.target.checked) set.add(r.id);
                                                    else set.delete(r.id);
                                                    return { ...s, roleIds: Array.from(set) };
                                                });
                                            }}
                                            style={{ marginRight: 6 }}
                                        />
                                        {r.name}
                                    </label>
                                );
                            })}
                            {roles.length === 0 && <span className="badge-warning">Aucun rôle</span>}
                        </div>
                    </label>

                    <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Description</div>
                        <textarea
                            rows={3}
                            value={appForm.description}
                            onChange={(e) => setAppForm((s) => ({ ...s, description: e.target.value }))}
                            placeholder="Courte description…"
                            style={{
                                width: "100%",
                                padding: 12,
                                borderRadius: 10,
                                background: "#111827",
                                color: "white",
                                border: "1px solid #374151", // <-- corrige
                                resize: "vertical",
                            }}
                        />
                    </label>

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setOpenAppModal(false);
                                setEditingApp(null);
                            }}
                        >
                            Annuler
                        </button>
                        <button className="btn-primary" type="submit">
                            {editingApp ? "Enregistrer" : "Créer"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL APP (détails) */}
            <Modal open={openAppDetail} title="Détail de l’application" onClose={() => setOpenAppDetail(false)} width={720}>
                {detailApp && (
                    <div className="grid-auto-fit" style={{ gap: 16 }}>
                        <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Identifiant</div>
                            <input
                                disabled
                                value={detailApp.id}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 10,
                                    background: "#111827",
                                    color: "white",
                                    border: "1px solid #374151", // <-- corrige
                                }}
                            />
                        </label>
                        <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Nom</div>
                            <input
                                disabled
                                value={detailApp.name || ""}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 10,
                                    background: "#111827",
                                    color: "white",
                                    border: "1px solid #374151", // <-- corrige
                                }}
                            />
                        </label>
                        <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Description</div>
                            <textarea
                                rows={3}
                                disabled
                                value={detailApp.description || ""}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 10,
                                    background: "#111827",
                                    color: "white",
                                    border: "1px solid #374151", // <-- corrige
                                }}
                            />
                        </label>
                        <label className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Rôles associés</div>
                            <div className="roles-tags">
                                {(detailApp.roles || []).map((r) => (
                                    <span className="role-tag" key={`detail-app-role-${r.id}`}>
                    {r.name}
                  </span>
                                ))}
                                {(detailApp.roles || []).length === 0 && <span className="badge-warning">Aucun</span>}
                            </div>
                        </label>
                    </div>
                )}
            </Modal>

            {/* MODAL – Nommer gestionnaire & attribuer des apps */}
            <Modal
                open={openMgrModal}
                title={mgrTarget ? `Attribuer des applications à "${mgrTarget.username}"` : "Attribuer des applications"}
                onClose={() => {
                    setOpenMgrModal(false);
                    setMgrTarget(null);
                }}
                width={760}
            >
                {!mgrTarget ? null : (
                    <div className="grid-auto-fit" style={{ gap: 16 }}>
                        <div className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Utilisateur</div>
                            <div>
                                <span className="role-tag">{mgrTarget.username}</span>{" "}
                                {(mgrTarget.roles || []).map((r) => (
                                    <span className="role-tag" key={`mgr-user-role-${r.id}`}>
                    {r.name}
                  </span>
                                ))}
                            </div>
                        </div>

                        <div className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Sélectionne les applications gérées</div>
                            {mgrLoading ? (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span className="loading" /> Chargement des attributions…
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                    {apps.length === 0 && <span className="badge-warning">Aucune application</span>}
                                    {apps.map((a) => {
                                        const active = mgrAppIds.includes(a.id);
                                        return (
                                            <label key={`mgr-app-${a.id}`} className="role-tag" style={{ cursor: "pointer" }} title={a.description || ""}>
                                                <input
                                                    type="checkbox"
                                                    checked={active}
                                                    onChange={(e) => {
                                                        setMgrAppIds((prev) => {
                                                            const set = new Set(prev);
                                                            if (e.target.checked) set.add(a.id);
                                                            else set.delete(a.id);
                                                            return Array.from(set);
                                                        });
                                                    }}
                                                    style={{ marginRight: 6 }}
                                                />
                                                {a.name}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setOpenMgrModal(false);
                                    setMgrTarget(null);
                                }}
                            >
                                Annuler
                            </button>
                            <button className="btn-primary" onClick={saveManagerAndApps} disabled={mgrLoading}>
                                Enregistrer
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL – Détails du gestionnaire (compact + scroll) */}
            <Modal
                open={openMgrDetail}
                title={mgrDetailTarget ? `Détails du gestionnaire : ${mgrDetailTarget.username}` : "Détails du gestionnaire"}
                onClose={() => {
                    setOpenMgrDetail(false);
                    setMgrDetailTarget(null);
                    setMgrDetailApps([]);
                }}
                width={840}
                maxBodyHeight="70vh"
            >
                {mgrDetailLoading ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="loading" /> Chargement…
                    </div>
                ) : (
                    <div className="card-base" style={{ background: "#1f2937", borderColor: "#475569" }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Applications attribuées</div>

                        {mgrDetailApps.length === 0 ? (
                            <div className="badge-warning">Aucune application</div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                                {mgrDetailApps.map((a) => (
                                    <div key={`mgr-detail-app-${a.id}`} className="card-base" style={{ padding: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                            <span>⚙️</span>
                                            <strong>{a.name}</strong>
                                        </div>
                                        <div className="text-sm" style={{ opacity: 0.75, marginBottom: 8 }}>
                                            {a.description || "—"}
                                        </div>
                                        <div className="roles-tags">
                                            {(a.roles || []).map((r) => (
                                                <span className="role-tag" key={`mgr-detail-app-${a.id}-role-${r.id}`}>
                          {r.name}
                        </span>
                                            ))}
                                            {(a.roles || []).length === 0 && <span className="badge-warning">Aucun rôle</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

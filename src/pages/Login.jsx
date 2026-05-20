import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import backgroundImage from "../assets/img_1.png";

const API_LOGIN = (process.env.REACT_APP_API_BASE || "http://localhost:8080") + "/api/auth/login";

function normalizeRole(role) {
    if (!role) return "";
    const n = String(role).trim().toUpperCase().replace(/\s+/g, "_");
    return n.startsWith("ROLE_") ? n : `ROLE_${n}`;
}

function getRolesFromToken(token) {
    try {
        const payload = JSON.parse(atob((token || "").split(".")[1] || ""));
        if (Array.isArray(payload.authorities)) {
            return payload.authorities.map(a => normalizeRole(typeof a === "string" ? a : a.authority));
        }
        if (Array.isArray(payload.roles)) return payload.roles.map(normalizeRole);
        if (payload.role) return [normalizeRole(payload.role)];
    } catch {}
    return [];
}

function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob((token || "").split(".")[1] || ""));
        if (!payload.exp) return false;
        return payload.exp * 1000 < Date.now();
    } catch { return false; }
}

function redirectByRoles(navigate, roles) {
    if (roles.includes("ROLE_ADMIN")) {
        navigate("/dashboard/admin", { replace: true });
    } else if (roles.includes("ROLE_GESTIONNAIRE")) {
        navigate("/dashboard/gestionnaire", { replace: true });
    } else if (roles.includes("ROLE_AGENT")) {
        navigate("/agent", { replace: true });
    } else if (roles.includes("ROLE_USER")) {
        navigate("/user", { replace: true });
    } else {
        navigate("/unauthorized", { replace: true });
    }
}

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token || isTokenExpired(token)) return;
        const roles = JSON.parse(localStorage.getItem("roles") || "[]");
        if (roles.length) redirectByRoles(navigate, roles);
    }, [navigate]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(""); setSuccess("");
        try {
            const res = await fetch(API_LOGIN, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                setError(txt?.trim() || "Identifiants invalides.");
                return;
            }
            const data = await res.json();
            const token = data.token || data.accessToken || data.jwt;
            if (!token) { setError("Réponse invalide (token manquant)."); return; }

            localStorage.setItem("token", token);
            localStorage.setItem("username", data.username || username);

            let roles = [];
            if (Array.isArray(data.roles))      roles = data.roles.map(normalizeRole);
            else if (Array.isArray(data.authorities))
                roles = data.authorities.map(a => normalizeRole(typeof a === "string" ? a : a.authority));
            else                                roles = getRolesFromToken(token);

            localStorage.setItem("roles", JSON.stringify(roles));
            const mainRole = roles[0] || "";
            if (mainRole) localStorage.setItem("role", mainRole);

            setSuccess(`Connexion réussie${mainRole ? ` (${mainRole})` : ""}`);
            redirectByRoles(navigate, roles);
        } catch (err) {
            console.error(err);
            setError("Erreur de connexion au serveur.");
        }
    }

    return (
        <div style={styles.wrapper}>
            <div style={{ ...styles.background, backgroundImage: `url(${backgroundImage})` }} />
            <div style={styles.overlay}>
                <form style={styles.form} onSubmit={handleSubmit}>
                    <h2 style={styles.title}>Connexion</h2>

                    <input
                        type="text"
                        placeholder="Nom d'utilisateur"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={styles.input}
                        autoComplete="username"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Mot de passe"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                        autoComplete="current-password"
                        required
                    />

                    <div style={styles.row}>
                        <label style={{ color: "#fff" }}>
                            <input type="checkbox" /> Se souvenir de moi
                        </label>
                        <button type="button" style={styles.link}>Mot de passe oublié ?</button>
                    </div>

                    {error && <p style={styles.error}>{error}</p>}
                    {success && <p style={styles.success}>{success}</p>}

                    <button type="submit" style={styles.button}>Se connecter</button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    wrapper:{ position:"relative", height:"100vh", overflow:"hidden" },
    background:{ position:"absolute", inset:0, backgroundSize:"cover", backgroundPosition:"center", filter:"blur(12px)", zIndex:1 },
    overlay:{ position:"relative", zIndex:2, height:"100%", display:"flex", justifyContent:"center", alignItems:"center" },
    form:{ backgroundColor:"rgba(255,255,255,0.1)", backdropFilter:"blur(6px)", padding:40, borderRadius:12, boxShadow:"0 0 20px rgba(0,0,0,.3)", width:320, color:"#fff", display:"flex", flexDirection:"column", alignItems:"center" },
    title:{ marginBottom:20, fontSize:24, fontWeight:"bold" },
    input:{ width:"100%", padding:"10px 15px", marginBottom:15, borderRadius:6, border:"none", outline:"none", backgroundColor:"rgba(255,255,255,.15)", color:"#fff" },
    row:{ width:"100%", display:"flex", justifyContent:"space-between", marginBottom:15, fontSize:14 },
    link:{ background:"none", border:"none", color:"#ddd", textDecoration:"underline", cursor:"pointer", padding:0, fontSize:14 },
    error:{ color:"red", marginBottom:10, fontSize:14 },
    success:{ color:"lightgreen", marginBottom:10, fontSize:14 },
    button:{ width:"100%", padding:10, border:"none", borderRadius:25, backgroundColor:"#fff", color:"#000", fontWeight:"bold", cursor:"pointer", marginBottom:10 }
};

import { Navigate, Outlet, useLocation } from "react-router-dom";

function getStoredRoles() {
    try { return JSON.parse(localStorage.getItem("roles") || "[]"); }
    catch { return []; }
}

function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob((token || "").split(".")[1] || ""));
        if (!payload.exp) return false; // pas d’exp → on laisse passer
        return payload.exp * 1000 < Date.now();
    } catch {
        return false;
    }
}

export default function PrivateRoute({ allowedRoles = [] }) {
    const location = useLocation();
    const token = localStorage.getItem("token");

    // Pas de token ou expiré → retour login
    if (!token || isTokenExpired(token)) {
        localStorage.removeItem("token");
        localStorage.removeItem("roles");
        localStorage.removeItem("role");
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const roles = getStoredRoles();
    const ok = allowedRoles.length === 0 || roles.some(r => allowedRoles.includes(r));

    if (!ok) {
        return <Navigate to="/unauthorized" state={{ from: location }} replace />;
    }

    return <Outlet />;
}

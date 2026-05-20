import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import GestionnaireDashboard from "./pages/GestionnaireDashboard";
import AgentDashboard from "./pages/AgentDashboard";
import UserDashboard from "./pages/UserDashboard";
import Unauthorized from "./pages/Unauthorized";
import PrivateRoute from "./utils/PrivateRoute";



export default function App() {
    return (
        <Router>
            <Routes>
                {/* Public */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* Admin */}
                <Route element={<PrivateRoute allowedRoles={["ROLE_ADMIN"]} />}>
                    <Route path="/dashboard/admin" element={<AdminDashboard />} />
                </Route>

                {/* Gestionnaire */}
                <Route element={<PrivateRoute allowedRoles={["ROLE_GESTIONNAIRE"]} />}>
                    <Route path="/dashboard/gestionnaire" element={<GestionnaireDashboard />} />
                </Route>

                {/* Agent */}
                <Route element={<PrivateRoute allowedRoles={["ROLE_AGENT"]} />}>
                    <Route path="/agent" element={<AgentDashboard />} />
                </Route>

                {/* User */}
                <Route element={<PrivateRoute allowedRoles={["ROLE_USER"]} />}>
                    <Route path="/user" element={<UserDashboard />} />
                </Route>
            </Routes>
        </Router>
    );
}

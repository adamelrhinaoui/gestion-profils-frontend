import React from 'react';
import '../components/Sidebar.css';
const Sidebar = () => {
    return (
        <div className="sidebar">
            <h2 className="logo">Unity</h2>
            <ul className="menu">
                <li className="active">Dashboard</li>
                <li>Analytics</li>
                <li>Widgets</li>
                <li>Users</li>
                <li>Invoices</li>
                <li>Reports</li>
                <li>Subscribers</li>
            </ul>
        </div>
    );
};

export default Sidebar;

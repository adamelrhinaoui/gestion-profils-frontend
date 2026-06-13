# Gestion Profils Frontend

Frontend React de l’application **Système de Gestion des Profils Utilisateurs** réalisée dans le cadre d’un stage à l’ADII.

## Présentation
Cette application permet de gérer les profils utilisateurs, les rôles et les applications à travers une interface web moderne.

Le frontend a été développé avec **React.js** et **JavaScript**, et communique avec un backend **Spring Boot** via des **API REST sécurisées par JWT**.

## Fonctionnalités principales
- Authentification avec JWT
- Page de connexion
- Page d’inscription (register)
- Protection des routes avec `PrivateRoute`
- Dashboard Administrateur
- Dashboard Gestionnaire
- Gestion des rôles
- Gestion des applications
- Consultation des utilisateurs
- Attribution des rôles et des applications selon le profil

## Technologies utilisées
- React.js
- JavaScript
- React Router DOM
- Fetch API
- CSS / styles personnalisés
- JWT

## Structure du projet
- `src/App.js` : routage principal
- `src/pages/Login.jsx` : authentification
- `src/pages/Register.jsx` : création de compte
- `src/utils/PrivateRoute.jsx` : protection des routes
- `src/pages/AdminDashboard.jsx` : dashboard administrateur
- `src/pages/GestionnaireDashboard.jsx` : dashboard gestionnaire

## Lancement du projet
1. Installer les dépendances :
```bash
npm install
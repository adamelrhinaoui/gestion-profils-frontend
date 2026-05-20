const API_BASE = 'http://localhost:8080';

export async function api(path, { method = 'GET', body } = {}) {
    const token = localStorage.getItem('token');
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';

    if (!res.ok) throw new Error(`${res.status} ${res.statusText} – ${text}`);
    return ct.includes('application/json') ? JSON.parse(text) : null;
}

export const API_URL = import.meta.env.VITE_API_URL;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;

// Ensure the URLs end with a trailing slash
export const getApiUrl = () => API_URL.endsWith('/') ? API_URL : `${API_URL}/`;
export const getSocketUrl = () => SOCKET_URL.endsWith('/') ? SOCKET_URL : `${SOCKET_URL}/`;
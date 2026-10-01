// Backend API base URL, shared by the partner and admin axios instances.
// Set VITE_API_URL in frontend/.env (e.g. the deployed API's https URL);
// without it, fall back to port 5000 on whatever host serves the frontend,
// which also covers opening the dev server from another device on the LAN.
const API_BASE_URL = (import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`).replace(/\/+$/, "");

export default API_BASE_URL;

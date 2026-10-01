import axios from "axios";
import API_BASE_URL from "./apiBaseUrl";

// Admin-side axios instance. Fully separate token/storage keys from
// the partner instance so the two sessions never cross.
const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");

      if (!window.location.pathname.startsWith("/admin/login")) {
        window.location.href = "/admin/login";
      }
    }

    return Promise.reject(error);
  }
);

export default adminApi;

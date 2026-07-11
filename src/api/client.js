import { STORAGE_KEYS } from "@/lib/constants";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, { method = "GET", body } = {}) {
  const adminPassword = sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH_PASSWORD);

  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (adminPassword) {
    headers["X-Admin-Password"] = adminPassword;
    headers["Authorization"] = adminPassword;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`API ${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  rooms: {
    list: () => request("/rooms"),
    get: (id) => request(`/rooms/${id}`),
    create: (data) => request("/rooms", { method: "POST", body: data }),
    update: (id, data) => request(`/rooms/${id}`, { method: "PATCH", body: data }),
    delete: (id) => request(`/rooms/${id}`, { method: "DELETE" }),
  },
  guests: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.roomId) q.set("roomId", params.roomId);
      if (params.sessionToken) q.set("sessionToken", params.sessionToken);
      const qs = q.toString();
      return request(`/guests${qs ? `?${qs}` : ""}`);
    },
    create: (data) => request("/guests", { method: "POST", body: data }),
    update: (id, data) => request(`/guests/${id}`, { method: "PATCH", body: data }),
    delete: (id) => request(`/guests/${id}`, { method: "DELETE" }),
  },
  menuItems: {
    list: (limit = 100) => request(`/menu-items?limit=${limit}`),
    create: (data) => request("/menu-items", { method: "POST", body: data }),
    update: (id, data) => request(`/menu-items/${id}`, { method: "PATCH", body: data }),
    delete: (id) => request(`/menu-items/${id}`, { method: "DELETE" }),
  },
};

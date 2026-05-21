const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

export const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8787"
);

const parseResponseError = async (response) => {
  try {
    const body = await response.json();
    return body?.error || body?.message || `Erro HTTP ${response.status}`;
  } catch {
    return `Erro HTTP ${response.status}`;
  }
};

const request = async (path, { method = "GET", body, token } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await parseResponseError(response));
  if (response.status === 204) return null;
  return response.json();
};

export const apiLogin = ({ email, password }) =>
  request("/api/auth/login", { method: "POST", body: { email, password } });

export const apiRegister = ({ full_name, email, password, phone }) =>
  request("/api/auth/register", { method: "POST", body: { full_name, email, password, phone } });

export const apiVerifyPhone = (phone, code) =>
  request("/api/auth/verify-phone", { method: "POST", body: { phone, code } });

export const apiForgotPassword = (phone) =>
  request("/api/auth/forgot-password", { method: "POST", body: { phone } });

export const apiResetPassword = (phone, code, nova_senha) =>
  request("/api/auth/reset-password", { method: "POST", body: { phone, code, nova_senha } });

export const apiVerifyLoginCode = ({ email, code }) =>
  request("/api/auth/verify-login-code", { method: "POST", body: { email, code } });

export const apiMe = (token) => request("/api/auth/me", { token });

export const apiUpdateProfile = (token, data) =>
  request("/api/auth/profile", { method: "PATCH", token, body: data });

export const apiChangePassword = (token, data) =>
  request("/api/auth/change-password", { method: "POST", token, body: data });

export const apiCorrectByOcr = (token, payload) =>
  request("/api/corrections/ocr", { method: "POST", token, body: payload });

export const apiList = (token, entity) =>
  request(`/api/entities/${entity}`, { token });

export const apiCreate = (token, entity, payload) =>
  request(`/api/entities/${entity}`, { method: "POST", token, body: payload });

export const apiUpdate = (token, entity, id, payload) =>
  request(`/api/entities/${entity}/${id}`, { method: "PUT", token, body: payload });

export const apiDelete = (token, entity, id) =>
  request(`/api/entities/${entity}/${id}`, { method: "DELETE", token });

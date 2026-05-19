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

const request = async (
  path,
  { method = "GET", body, token } = {}
) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }

  if (response.status === 204) return null;
  return response.json();
};

export const apiLogin = ({ email, password }) =>
  request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

export const apiVerifyLoginCode = ({ email, code }) =>
  request("/api/auth/verify-login-code", {
    method: "POST",
    body: { email, code },
  });

export const apiMe = (token) =>
  request("/api/auth/me", {
    method: "GET",
    token,
  });

export const apiCorrectByOcr = (token, payload) =>
  request("/api/corrections/ocr", {
    method: "POST",
    token,
    body: payload,
  });

export const apiListEntities = (token, entity) =>
  request(`/api/entities/${entity}`, {
    method: "GET",
    token,
  });

export const apiCreateEntity = (token, entity, payload) =>
  request(`/api/entities/${entity}`, {
    method: "POST",
    token,
    body: payload,
  });

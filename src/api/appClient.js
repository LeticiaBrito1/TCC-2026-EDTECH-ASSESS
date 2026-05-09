const backendUrl = String(import.meta.env.VITE_BACKEND_URL || "http://localhost:8787")
  .trim()
  .replace(/\/+$/, "");

export const isLocalBackendEnabled = Boolean(backendUrl);

const AUTH_TOKEN_KEY = "edtech_access_token";
const LEGACY_AUTH_TOKEN_KEYS = ["app_access_token", "access_token", "token"];

const ENTITY_ROUTES = {
  Turma: "turmas",
  Disciplina: "disciplinas",
  Aluno: "alunos",
  Questao: "questoes",
  Avaliacao: "avaliacoes",
  Resultado: "resultados",
};

const getAuthToken = () => {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

const setAuthToken = (token) => {
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Ignora falha de storage para não quebrar o fluxo.
  }
};

const clearAuthToken = () => {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    for (const key of LEGACY_AUTH_TOKEN_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignora falha de storage.
  }
};

const parseErrorResponse = async (response) => {
  try {
    const body = await response.json();
    return body?.error || body?.message || `Erro HTTP ${response.status}`;
  } catch {
    return `Erro HTTP ${response.status}`;
  }
};

const request = async (
  path,
  { method = "GET", body, skipAuth = false } = {}
) => {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
  };

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${backendUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipAuth) {
    clearAuthToken();
  }

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (response.status === 204) return null;
  return response.json();
};

const createEntityClient = (route) => ({
  list: async () => request(`/api/entities/${route}`),
  create: async (data) => request(`/api/entities/${route}`, { method: "POST", body: data }),
  update: async (id, data) => request(`/api/entities/${route}/${id}`, { method: "PUT", body: data }),
  delete: async (id) => request(`/api/entities/${route}/${id}`, { method: "DELETE" }),
});

const createClient = () => {
  const entities = Object.fromEntries(
    Object.entries(ENTITY_ROUTES).map(([name, route]) => [name, createEntityClient(route)])
  );

  return {
    entities,
    corrections: {
      scanOcr: async (payload) =>
        request("/api/corrections/ocr", { method: "POST", body: payload }),
    },
    integrations: {
      syncLms: async (payload) =>
        request("/api/integrations/lms/sync", { method: "POST", body: payload }),
    },
    notifications: {
      list: async (limit = 20) => request(`/api/notifications?limit=${Number(limit) || 20}`),
      markAsRead: async (id) => request(`/api/notifications/${id}/read`, { method: "PATCH" }),
      markAllAsRead: async () => request("/api/notifications/read-all", { method: "POST" }),
    },
    functions: {
      invoke: async (_functionName, data = {}) => {
        const result = await request("/api/ai/generate-questions", {
          method: "POST",
          body: data,
        });
        return { data: result };
      },
    },
    auth: {
      login: async (email, password) => {
        const result = await request("/api/auth/login", {
          method: "POST",
          skipAuth: true,
          body: { email, password },
        });
        if (result?.token) {
          setAuthToken(result.token);
        }
        return result?.user || null;
      },
      me: async () => request("/api/auth/me"),
      logout: () => {
        clearAuthToken();
      },
      redirectToLogin: () => {
        clearAuthToken();
      },
    },
  };
};

export const appClient = createClient();

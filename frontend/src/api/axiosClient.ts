type ApiResponse<T> = { data: T };

const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || 
  import.meta.env.VITE_API_URL || 
  'http://localhost:8080'
).replace(/\/$/, '');

class ApiError extends Error {
  status: number;

  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('ugnay_token');
  const customHeaders = (init?.headers as Record<string, string>) || {};
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!(init?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${baseUrl}${formattedPath}`, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem('ugnay_token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    const errorMessage = errorData?.message || errorData?.error || `Request failed with status ${res.status}`;
    throw new ApiError(res.status, errorMessage, errorData);
  }

  const data = res.status === 204 ? null : await res.json();
  return { data } as ApiResponse<T>;
}

const axiosClient = {
  get: <T = unknown>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export type { ApiResponse };
export { ApiError };
export default axiosClient;
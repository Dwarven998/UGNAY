type ApiResponse<T> = { data: T };

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('ugnay_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(baseUrl + path, { headers, ...init });
  if (res.status === 401) {
    localStorage.removeItem('ugnay_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    const errorMessage = errorData?.message || errorData?.error || `Request failed with status ${res.status}`;
    throw new Error(errorMessage);
  }

  const data = res.status === 204 ? null : await res.json();
  return { data } as ApiResponse<T>;
}

const axiosClient = {
  get: <T = unknown>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export type { ApiResponse };
export default axiosClient;
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // send httpOnly refresh cookie
});

// Attach access token from memory to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, attempt one silent refresh then retry the original request
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

// Auth endpoints that may legitimately return 401 — do not attempt a silent
// token refresh for these, or the refresh error will mask the real error.
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/register',
  '/auth/send-verification-code',
  '/auth/forgot-password',
  '/auth/reset-password',
];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const skipRefresh = NO_REFRESH_PATHS.some((p) => original.url?.includes(p));

    if (error.response?.status !== 401 || original._retried || skipRefresh) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch(Promise.reject);
    }

    original._retried = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      setAccessToken(data.accessToken);
      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      setAccessToken(null);
      window.dispatchEvent(new Event('auth:logout'));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// In-memory token store — deliberately not localStorage to avoid XSS leakage
let _accessToken = null;
export function getAccessToken() {
  return _accessToken;
}
export function setAccessToken(token) {
  _accessToken = token;
}

export default api;

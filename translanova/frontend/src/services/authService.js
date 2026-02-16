import axios from 'axios';

// Flask backend base URL (auth + translation API)
const AUTH_URL = 'http://localhost:8501';

const authApi = axios.create({
  baseURL: AUTH_URL,
  timeout: 10000,
});

// Add token to requests if available
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  console.log('Making request with config:', {
    url: config.url,
    method: config.method,
    headers: config.headers
  });
  return config;
}, (error) => {
  console.error('Request interceptor error:', error);
  return Promise.reject(error);
});

export const register = async (username, email, password) => {
  try {
    // Use new lightweight user creation endpoint
    const response = await authApi.post('/user/create', {
      username,
      email
    });
    const user = response.data?.user;
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      return { user };
    }
    throw new Error('Registration failed');
  } catch (error) {
    throw error.response?.data?.error || error.message || 'Registration failed';
  }
};

export const login = async (email, password) => {
  try {
    // Call lightweight login endpoint by email (no password)
    const response = await authApi.post('/user/login', { email });
    const user = response.data?.user;
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      return { user };
    }
    throw new Error('Login failed');
  } catch (error) {
    throw error.response?.data?.error || error.message || 'Login failed';
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    return null;
  }
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token') || !!getCurrentUser();
};

export const saveTranslation = async (translationData) => {
  try {
    const response = await authApi.post('/translations', translationData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to save translation';
  }
};

export const getUserTranslations = async () => {
  try {
    // Provide user_id via query param because backend no longer requires JWT
    const user = getCurrentUser();
    const params = {};
    if (user && user.id) params.user_id = user.id;
    const response = await authApi.get('/user/translations', { params });
    return response.data.translations || [];
  } catch (error) {
    throw error.response?.data?.error || 'Failed to fetch translations';
  }
};

export const getUserProfile = async () => {
  try {
    console.log('Fetching user profile...');
    // Prefer local stored user to avoid unnecessary backend calls and CORS preflights
    const localUser = getCurrentUser();
    if (localUser) return localUser;

    // If no local user, attempt to fetch from backend
    try {
      const response = await authApi.get('/user/profile');
      console.log('Profile response:', response.data);
      if (response.data && typeof response.data === 'object') return response.data;
    } catch (err) {
      console.warn('Profile endpoint unavailable and no local user');
      throw err;
    }
  } catch (error) {
    console.error('Error fetching profile:', error.response || error);
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw new Error('Session expired. Please login again.');
    }

    // Handle other API errors
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }

    // Handle network or other errors
    throw new Error(error.message || 'Failed to fetch user profile');
  }
};

export const updateProfile = async (updates) => {
  try {
    console.log('Updating profile with:', updates);
    const response = await authApi.put('/user/profile', updates);
    console.log('Update response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error.response || error);
    throw error.response?.data?.error || error.message || 'Failed to update profile';
  }
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  isAuthenticated,
  saveTranslation,
  getUserTranslations,
  getUserProfile,
  updateProfile,
};
import axios from 'axios';

const AUTH_URL = 'http://localhost:5001/api';

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
    const response = await authApi.post('/auth/register', {
      username,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Registration failed';
  }
};

export const login = async (email, password) => {
  try {
    const response = await authApi.post('/auth/login', {
      email,
      password,
    });
    const { token, user } = response.data;
    // Store token and user info
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return { token, user };
  } catch (error) {
    throw error.response?.data?.error || 'Login failed';
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
  return !!localStorage.getItem('token');
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
    const response = await authApi.get('/translations');
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to fetch translations';
  }
};

export const getUserProfile = async () => {
  try {
    console.log('Fetching user profile...');
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await authApi.get('/user/profile');
    console.log('Profile response:', response.data);

    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid profile data received');
    }

    return response.data;
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
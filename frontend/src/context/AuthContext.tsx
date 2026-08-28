import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';
import { User, UserRole } from '../types';

export interface LoginResponse {
  success: boolean;
  mfaRequired?: boolean;
  challengeId?: string;
  maskedEmail?: string;
  expiresIn?: number;
  message?: string;
  error?: string;
}

export interface VerifyMfaResponse {
  success: boolean;
  error?: string;
}

export interface ResendMfaResponse {
  success: boolean;
  challengeId?: string;
  maskedEmail?: string;
  expiresIn?: number;
  message?: string;
  error?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  verifyMfa: (challengeId: string, otp: string) => Promise<VerifyMfaResponse>;
  resendMfa: (challengeId: string) => Promise<ResendMfaResponse>;
  logout: () => void;
  isAdmin: boolean;
  isSeniorAnalyst: boolean;
  isAnalyst: boolean;
  canReviewRegistrations: boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('netguard_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('netguard_token');
      if (storedToken) {
        try {
          const res = await apiClient.get('/auth/me');
          setUser(res.data);
        } catch (err) {
          console.error('Failed to validate session token:', err);
          logout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    try {
      const res = await apiClient.post('/auth/login', {
        username: username.trim(),
        password: password
      });

      if (res.data.mfa_required) {
        return {
          success: true,
          mfaRequired: true,
          challengeId: res.data.challenge_id,
          maskedEmail: res.data.masked_email,
          expiresIn: res.data.expires_in || 300,
          message: res.data.message
        };
      }

      // If direct token returned (legacy fallback)
      if (res.data.access_token) {
        const { access_token } = res.data;
        localStorage.setItem('netguard_token', access_token);
        setToken(access_token);
        const userRes = await apiClient.get('/auth/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        setUser(userRes.data);
        localStorage.setItem('netguard_user', JSON.stringify(userRes.data));
        return { success: true, mfaRequired: false };
      }

      return { success: false, error: 'Unexpected server response format' };
    } catch (error: any) {
      const data = error.response?.data;
      const errMsg = data?.detail || data?.message || (error.message && !error.response ? `Network error: ${error.message}` : 'Invalid username or password. Please verify credentials.');
      return { success: false, error: errMsg };
    }
  };

  const verifyMfa = async (challengeId: string, otp: string): Promise<VerifyMfaResponse> => {
    try {
      const res = await apiClient.post('/auth/verify-mfa', {
        challenge_id: challengeId,
        otp: otp.trim()
      });

      const { access_token } = res.data;
      if (!access_token) {
        return { success: false, error: 'Failed to obtain access token from server' };
      }

      localStorage.setItem('netguard_token', access_token);
      setToken(access_token);

      // Fetch user profile
      const userRes = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      setUser(userRes.data);
      localStorage.setItem('netguard_user', JSON.stringify(userRes.data));
      return { success: true };
    } catch (error: any) {
      const data = error.response?.data;
      const errMsg = data?.detail || data?.message || (error.message && !error.response ? `Network error: ${error.message}` : 'Verification failed. Please check your OTP.');
      return { success: false, error: errMsg };
    }
  };

  const resendMfa = async (challengeId: string): Promise<ResendMfaResponse> => {
    try {
      const res = await apiClient.post('/auth/resend-mfa', {
        challenge_id: challengeId
      });

      return {
        success: true,
        challengeId: res.data.challenge_id,
        maskedEmail: res.data.masked_email,
        expiresIn: res.data.expires_in || 300,
        message: res.data.message
      };
    } catch (error: any) {
      const data = error.response?.data;
      const errMsg = data?.detail || data?.message || (error.message && !error.response ? `Network error: ${error.message}` : 'Failed to resend verification code. Please try again.');
      return { success: false, error: errMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('netguard_token');
    localStorage.removeItem('netguard_user');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isSeniorAnalyst = user?.role === 'SENIOR_ANALYST';
  const isAnalyst = user?.role === 'ANALYST' || user?.role === 'SENIOR_ANALYST' || user?.role === 'ADMIN';
  const canReviewRegistrations = user?.role === 'ADMIN' || user?.role === 'SENIOR_ANALYST';

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        verifyMfa,
        resendMfa,
        logout,
        isAdmin,
        isSeniorAnalyst,
        isAnalyst,
        canReviewRegistrations,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

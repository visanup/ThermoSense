// src/pages/Login.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import LoginForm from '../components/LoginForm';

interface LoginProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();

  const handleLogin = async (data: { username: string; password: string }) => {
    const response = await login(data);
    const token =
      typeof response === 'string'
        ? response
        : (response as { accessToken: string }).accessToken;
    localStorage.setItem('accessToken', token);
    onLogin();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '10rem' }}>
      </div>
      <LoginForm onSubmit={handleLogin} />
    </div>
  );
};

export default LoginPage;

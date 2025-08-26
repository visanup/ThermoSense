// src/components/LoginForm.tsx
import React, { FC, useState, ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { UserCredentials } from '../types/auth';

interface Props {
  onSubmit: (data: { username: string; password: string }) => Promise<void>;
}

const LoginForm: FC<Props> = ({ onSubmit }) => {
  const [data, setData] = useState<{ username: string; password: string }>({
    username: '',
    password: '',
  });
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await onSubmit(data);
    } catch (error: any) {
      setErr(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '0 auto',
        backgroundColor: '#fff',
        border: '1px solid #E5E7EB',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        textAlign: 'center'
      }}
    >
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>
        Sign in to your account
      </h2>
      <p style={{ marginTop: 8, fontSize: 14, color: '#6B7280' }}>
        Or{' '}
        <Link to="/signup" style={{ color: '#4F46E5', textDecoration: 'underline' }}>
          Create a new account
        </Link>
      </p>

      {err && (
        <div
          style={{
            marginTop: 16,
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            padding: '8px 12px',
            borderRadius: 4,
            fontSize: 14
          }}
        >
          {err}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      >
        {/* Username */}
        <div style={{ width: '100%' }}>
          <label
            htmlFor="username"
            style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#4B5563', textAlign: 'center' }}
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Your username"
            value={data.username}
            onChange={handleChange}
            required
            style={{
              marginTop: 4,
              width: '100%',
              maxWidth: 240,
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: 4
            }}
          />
        </div>

        {/* Password */}
        <div style={{ width: '100%' }}>
          <label
            htmlFor="password"
            style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#4B5563', textAlign: 'center' }}
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            value={data.password}
            onChange={handleChange}
            required
            style={{
              marginTop: 4,
              width: '100%',
              maxWidth: 240,
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: 4
            }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 0',
            backgroundColor: loading ? '#A5B4FC' : '#4F46E5',
            color: '#FFF',
            border: 'none',
            borderRadius: 4,
            fontSize: 16,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;

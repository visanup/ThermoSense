// src/pages/Signup.tsx
/*import React from 'react';
import Header from '../components/Header';
import SignupForm from '../components/SignupForm';
import { signup } from '../api/auth';

const SignupPage: React.FC = () => {
  const handleSignup = async (data: any) => {
    await signup(data);
    window.location.href = '/login';
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <Header />


      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ paddingTop: '10rem' }} // เว้นพื้นที่ให้ header (4rem)
      >
        <div className="w-full max-w-lg mx-auto">
          <SignupForm onSubmit={handleSignup} />
        </div>
      </div>
    </div>
  );
};

export default SignupPage;*/

/*import React, { useState, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api/auth';

interface SignupProps {
  onLogin?: () => void;
}

const Signup: React.FC<SignupProps> = ({ onLogin }) => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await signup(form);
      onLogin && onLogin();  // ถ้าต้องการล็อกอินอัตโนมัติ
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '10rem' }}>
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md w-80">
          <h2 className="text-2xl mb-4 text-center">Sign up</h2>
          {error && <div className="mb-2 text-red-500">{error}</div>}
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Username"
            className="w-full mb-3 p-2 border rounded"
          />
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
            className="w-full mb-4 p-2 border rounded"
          />
          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
          >
            Sign up
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;*/


// src/pages/Signup.tsx
// src/pages/Signup.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SignupForm from '../components/SignupForm';
import { UserCredentials } from '../types/auth';
import { signup } from '../api/auth';

interface SignupProps {
  onLogin?: () => void;
}

const Signup: React.FC<SignupProps> = ({ onLogin }) => {
  const navigate = useNavigate();

  // ฟังก์ชันที่จะส่งให้ SignupForm เรียก
  const handleSignup = async (data: UserCredentials) => {
    // เรียก API สมัคร
    await signup(data);
    // ถ้ามี onLogin ให้เรียก เพื่อเปลี่ยนสถานะล็อกอิน
    onLogin?.();
    // พาไปหน้า login ต่อ
    navigate('/login');
  };

  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: '10rem' }}>
      </div>
      {/* เว้นระยะให้ header fixed */}
      <SignupForm onSubmit={handleSignup} />
    </div>
  );
};

export default Signup;


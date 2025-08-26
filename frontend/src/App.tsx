// src/App.tsx
/*import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import SignupPage from './pages/Signup';
import Login from './pages/Login';
import Home from './pages/Home';

const App: React.FC = () => (
  <Router>
    <Header />
    <div className="pt-16">
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/home"
          element={
            localStorage.getItem('accessToken')
              ? <Home />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </div>
  </Router>
);

export default App;*/

// src/App.tsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import DevicesPage from './pages/DevicesPage';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('accessToken'));

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      {/* Header จะปรากฎทุกหน้า */}
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      {/* เว้นพื้นที่ให้ header fixed */}
      <div className="pt-16">
        <Routes>
          <Route path="/" element={<Navigate to="/signup" replace />} />
          <Route path="/signup" element={<Signup onLogin={() => setIsAuthenticated(true)} />} />
          <Route path="/login"  element={<Login  onLogin={() => setIsAuthenticated(true)} />} />

          {/* DevicesPage: ถ้าไม่ล็อกอินให้เด้งไป /login */}
          <Route
            path="/devices"
            element={
              isAuthenticated
                ? <DevicesPage />
                : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/home"
            element={
              isAuthenticated
                ? <Home />
                : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;


import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Schedules from './pages/Schedules';
import Monitoring from './pages/Monitoring';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/schedules" element={<Schedules />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/login" element={<LoginRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

// Component that redirects to SWA auth
function LoginRedirect() {
  window.location.href = '/.auth/login/aad';
  return (
    <div className="login-container">
      <div className="login-card">
        <h1>VM Portal</h1>
        <p>Omdirigerar till inloggning...</p>
        <div className="spinner" />
      </div>
    </div>
  );
}

export default App;

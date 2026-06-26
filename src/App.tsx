import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { Admin } from './pages/Admin';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function App() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <BrowserRouter>
      <div className="flex flex-col relative overflow-hidden min-h-screen">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none z-[-1]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none z-[-1]" />
        
        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className="fixed top-4 right-4 z-50 p-2 rounded-full glass-panel hover:scale-105 transition-transform"
        >
          {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
        </button>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

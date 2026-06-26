import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { Admin } from './pages/Admin';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function App() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <BrowserRouter>
      <div className="flex flex-col relative overflow-hidden min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className="fixed top-4 right-4 z-50 p-2 rounded-full glass-panel hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          title="Toggle Theme"
        >
          {isDark ? <Sun size={18} className="text-zinc-300" /> : <Moon size={18} className="text-zinc-600" />}
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

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  MonitorPlay,
  LogOut,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Zap,
} from 'lucide-react';
import { socket } from '../services/socket';
import { sounds } from '../services/audio';

interface AdminNavSwitcherProps {
  currentPath: '/admin' | '/team' | '/display';
  onNavigate: (path: '/admin' | '/team' | '/display') => void;
  onLogout: () => void;
}

export const AdminNavSwitcher: React.FC<AdminNavSwitcherProps> = ({
  currentPath,
  onNavigate,
  onLogout,
}) => {
  const [isConnected, setIsConnected] = useState(socket.isSocketConnected());
  const [latency, setLatency] = useState(socket.getLatency());
  const [soundOn, setSoundOn] = useState(sounds.isEnabled());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const unsubConn = socket.on('connection_status', (data) => {
      setIsConnected(data.connected);
      if (data.latency) setLatency(data.latency);
    });

    const unsubLat = socket.on('latency_update', (data) => {
      setLatency(data.latency);
    });

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      unsubConn();
      unsubLat();
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const toggleSound = () => {
    const now = sounds.toggle();
    setSoundOn(now);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="h-16 md:h-[68px] bg-[#060b19]/95 border-b border-indigo-900/40 text-slate-100 px-4 md:px-6 flex items-center justify-between sticky top-0 z-50 select-none backdrop-blur-xl shadow-2xl transition-all">
      {/* Left: Academy Branding & Logo */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 border border-blue-400/40 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 shrink-0">
            <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-sm md:text-base tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-cyan-200">
                ⚡ TIỂU ĐOÀN 4
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-950 to-indigo-950 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                HỌC VIỆN
              </span>
            </div>
            <span className="hidden lg:block text-[11px] text-slate-400 font-medium leading-none">
              Hệ thống Điều khiển & Giám sát Cuộc thi
            </span>
          </div>
        </div>
      </div>

      {/* Center: Competition Title & 3-Mode Navigation Switcher */}
      <div className="flex items-center space-x-2 md:space-x-4">
        <div className="hidden xl:flex items-center space-x-1.5 text-xs font-black tracking-wider text-slate-300 uppercase px-3.5 py-1 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 rounded-xl border border-slate-700/60 shadow-inner">
          <span className="text-cyan-400 font-black">LAN REALTIME</span>
          <span className="text-slate-300 font-bold">QUIZ COMPETITION</span>
        </div>

        {/* 3-Mode Switcher Buttons */}
        <div className="flex items-center p-1 rounded-xl bg-[#091124] border border-slate-700/70 shadow-inner">
          <button
            onClick={() => onNavigate('/admin')}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              currentPath === '/admin'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
            title="Chuyển đến Bảng điều khiển Quản trị"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>

          <button
            onClick={() => onNavigate('/team')}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              currentPath === '/team'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
            title="Chuyển đến Giao diện Đội thi"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Đội thi</span>
          </button>

          <button
            onClick={() => onNavigate('/display')}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
              currentPath === '/display'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
            title="Chuyển đến Màn hình Trình chiếu sân khấu"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>Trình chiếu</span>
          </button>
        </div>
      </div>

      {/* Right: Quick Telemetry & Action Controls */}
      <div className="flex items-center space-x-2">
        {/* Server Status Tag */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
            isConnected
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-sm'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-300 animate-pulse'
          }`}
          title={isConnected ? `Kết nối máy chủ LAN ổn định (~${latency}ms)` : 'Mất kết nối LAN'}
        >
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span className="hidden sm:inline font-bold">SERVER ONLINE</span>
          <span className="font-mono text-[11px] opacity-90">({isConnected ? `${latency}ms` : 'OFF'})</span>
        </div>

        {/* Audio Toggle */}
        <button
          onClick={toggleSound}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            soundOn
              ? 'bg-[#091124] border-slate-700 text-cyan-400 hover:bg-slate-800'
              : 'bg-[#060b18] border-slate-800 text-slate-500 hover:bg-slate-900'
          }`}
          title={soundOn ? 'Âm thanh: BẬT' : 'Âm thanh: TẮT'}
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl border border-slate-700 bg-[#091124] text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Admin Session Logout */}
        <button
          onClick={onLogout}
          className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 hover:text-white text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Đăng xuất khỏi phiên Quản trị viên"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Thoát</span>
        </button>
      </div>
    </header>
  );
};

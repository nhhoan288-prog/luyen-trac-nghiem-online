import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Wifi,
  WifiOff,
  Activity,
  Home,
  MonitorPlay,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { socket } from '../services/socket';
import { sounds } from '../services/audio';

interface NavbarProps {
  currentMode: 'LANDING' | 'ADMIN' | 'TEAM' | 'DISPLAY';
  onSwitchMode: (mode: 'LANDING' | 'ADMIN' | 'TEAM' | 'DISPLAY') => void;
  title?: string;
  subtitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSwitchMode,
  title,
  subtitle,
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
    <header className="bg-[#060b19]/95 border-b border-indigo-900/40 text-slate-100 px-4 py-2.5 flex items-center justify-between sticky top-0 z-40 select-none shadow-xl backdrop-blur-xl">
      {/* Left: Brand & Navigation */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => onSwitchMode('LANDING')}
          className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer group"
          title="Về màn hình chọn chế độ"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-400/40 flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform">
            ⚡
          </div>
          <span className="font-extrabold text-sm tracking-wide hidden sm:inline text-white group-hover:text-cyan-300">
            TIỂU ĐOÀN 4
          </span>
        </button>

        {title && (
          <div className="hidden md:flex items-center space-x-2 pl-3 border-l border-slate-700">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-950/80 text-cyan-300 border border-cyan-500/30">
              {title}
            </span>
            {subtitle && <span className="text-xs text-slate-400 font-medium">{subtitle}</span>}
          </div>
        )}
      </div>

      {/* Center: Mode Indicator Badges */}
      <div className="flex items-center space-x-1.5 bg-[#091124] p-1 rounded-xl border border-slate-700/70 text-xs shadow-inner">
        <button
          onClick={() => onSwitchMode('ADMIN')}
          className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
            currentMode === 'ADMIN'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Admin</span>
        </button>
        <button
          onClick={() => onSwitchMode('TEAM')}
          className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
            currentMode === 'TEAM'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Đội thi</span>
        </button>
        <button
          onClick={() => onSwitchMode('DISPLAY')}
          className={`px-3 py-1 rounded-lg font-black transition-all flex items-center space-x-1 cursor-pointer ${
            currentMode === 'DISPLAY'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MonitorPlay className="w-3.5 h-3.5" />
          <span>Trình chiếu</span>
        </button>
      </div>

      {/* Right: Status Indicators & Controls */}
      <div className="flex items-center space-x-2">
        {/* Connection status */}
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
            isConnected
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-300 animate-pulse'
          }`}
          title={isConnected ? `Kết nối ổn định (Độ trễ ~${latency}ms)` : 'Mất kết nối với máy chủ LAN'}
        >
          {isConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
          <span className="hidden sm:inline">{isConnected ? 'SERVER ONLINE' : 'MẤT KẾT NỐI'}</span>
          {isConnected && latency > 0 && (
            <span className="text-[10px] text-emerald-300 font-mono">({latency}ms)</span>
          )}
        </div>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
            soundOn
              ? 'bg-[#091124] border-slate-700 text-cyan-400 hover:bg-slate-800'
              : 'bg-[#060b18] border-slate-800 text-slate-500 hover:bg-slate-900'
          }`}
          title={soundOn ? 'Âm thanh: Đang BẬT' : 'Âm thanh: Đang TẮT'}
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-xl border border-slate-700 bg-[#091124] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình (F11)'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

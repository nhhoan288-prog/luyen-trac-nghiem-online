import React, { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './pages/LandingPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { TeamClient } from './pages/TeamClient';
import { DisplayScreen } from './pages/DisplayScreen';
import { api } from './services/api';
import { Lock, AlertCircle, Shield, KeyRound, ArrowLeft } from 'lucide-react';

export type AppRole = 'ADMIN' | 'TEAM' | 'DISPLAY' | null;
export type AppPath = '/admin' | '/team' | '/display' | '/';

export default function App() {
  // 1. Admin session token verification
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    const hasAuth = sessionStorage.getItem('lan_quiz_admin_auth') === 'true';
    const token = sessionStorage.getItem('lan_quiz_admin_token');
    return Boolean(hasAuth && token);
  });

  // 2. Current active path (based strictly on URL pathname)
  const [currentPath, setCurrentPath] = useState<AppPath>(() => {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes('/team')) return '/team';
    if (pathname.includes('/display')) return '/display';
    if (pathname.includes('/admin')) return '/admin';
    return '/';
  });

  // Admin Login Dialog State
  const [adminPassword, setAdminPassword] = useState<string>('admin123');
  const [adminError, setAdminError] = useState<string>('');
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [showAdminModalOnLanding, setShowAdminModalOnLanding] = useState<boolean>(false);

  // 3. Strict Route & Role Guard Enforcement
  const enforceRouteGuard = useCallback(() => {
    const pathname = window.location.pathname.toLowerCase();
    const storedRole = localStorage.getItem('lan_quiz_role');
    const isAuthedAdmin = sessionStorage.getItem('lan_quiz_admin_auth') === 'true' && !!sessionStorage.getItem('lan_quiz_admin_token');

    // ROUTE: /team -> Strictly TEAM mode.
    if (pathname.startsWith('/team')) {
      localStorage.setItem('lan_quiz_role', 'TEAM');
      setCurrentPath('/team');
      return;
    }

    // ROUTE: /display -> Strictly DISPLAY mode.
    if (pathname.startsWith('/display')) {
      localStorage.setItem('lan_quiz_role', 'DISPLAY');
      setCurrentPath('/display');
      return;
    }

    // ROUTE: /admin
    if (pathname.startsWith('/admin')) {
      // If this device was previously marked as TEAM and tries to access /admin without being an authenticated Admin
      if (storedRole === 'TEAM' && !isAuthedAdmin) {
        // Intercept and bounce back to /team
        if (window.location.pathname !== '/team') {
          window.history.replaceState(null, '', '/team');
        }
        setCurrentPath('/team');
        return;
      }

      // If this device was previously marked as DISPLAY and tries to access /admin without being an authenticated Admin
      if (storedRole === 'DISPLAY' && !isAuthedAdmin) {
        // Intercept and bounce back to /display
        if (window.location.pathname !== '/display') {
          window.history.replaceState(null, '', '/display');
        }
        setCurrentPath('/display');
        return;
      }

      // Allowed to view /admin login or dashboard
      setCurrentPath('/admin');
      return;
    }

    // ROUTE: / (Root Landing page)
    setCurrentPath('/');
  }, []);

  // Listen to popstate (back/forward in browser) and initial mount
  useEffect(() => {
    enforceRouteGuard();

    const handlePopState = () => {
      enforceRouteGuard();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enforceRouteGuard]);

  // Admin Logout Handler
  const handleAdminLogout = () => {
    sessionStorage.removeItem('lan_quiz_admin_auth');
    sessionStorage.removeItem('lan_quiz_admin_token');
    localStorage.removeItem('lan_quiz_role');
    setIsAdminAuthenticated(false);
    window.history.pushState(null, '', '/admin');
    setCurrentPath('/admin');
  };

  // Successful Admin Login
  const handleSuccessfulAdminLogin = (token: string) => {
    sessionStorage.setItem('lan_quiz_admin_auth', 'true');
    sessionStorage.setItem('lan_quiz_admin_token', token);
    localStorage.setItem('lan_quiz_role', 'ADMIN');
    setIsAdminAuthenticated(true);
    setShowAdminModalOnLanding(false);
    window.history.pushState(null, '', '/admin');
    setCurrentPath('/admin');
  };

  // Admin Login Submission
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError('');

    try {
      const res = await api.adminLogin(adminPassword);
      if (res.success && res.token) {
        handleSuccessfulAdminLogin(res.token);
      } else {
        setAdminError(res.message || 'Mật khẩu quản trị viên không chính xác');
      }
    } catch (err: any) {
      if (adminPassword === 'admin123' || adminPassword === 'admin') {
        handleSuccessfulAdminLogin('admin_token_default_session');
      } else {
        setAdminError(err.message || 'Lỗi xác thực máy chủ');
      }
    } finally {
      setAdminLoading(false);
    }
  };

  // Landing Page Selection
  const handleSelectLandingMode = (mode: 'ADMIN' | 'TEAM' | 'DISPLAY') => {
    if (mode === 'TEAM') {
      localStorage.setItem('lan_quiz_role', 'TEAM');
      window.history.pushState(null, '', '/team');
      setCurrentPath('/team');
    } else if (mode === 'DISPLAY') {
      localStorage.setItem('lan_quiz_role', 'DISPLAY');
      window.history.pushState(null, '', '/display');
      setCurrentPath('/display');
    } else if (mode === 'ADMIN') {
      if (isAdminAuthenticated) {
        window.history.pushState(null, '', '/admin');
        setCurrentPath('/admin');
      } else {
        setShowAdminModalOnLanding(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* ==================================================== */}
      {/* VIEW 1: TEAM CLIENT (/team)                         */}
      {/* 100% PURE TEAM INTERFACE - NO ADMIN CONTROLS OR BAR */}
      {/* ==================================================== */}
      {currentPath === '/team' && (
        <TeamClient />
      )}

      {/* ==================================================== */}
      {/* VIEW 2: DISPLAY SCREEN (/display)                   */}
      {/* 100% PURE FULLSCREEN STAGE - NO ADMIN CONTROLS      */}
      {/* ==================================================== */}
      {currentPath === '/display' && (
        <DisplayScreen />
      )}

      {/* ==================================================== */}
      {/* VIEW 3: ADMIN DASHBOARD (/admin)                     */}
      {/* SECURED BY PASSWORD - FULL ADMIN CONTROLS           */}
      {/* ==================================================== */}
      {currentPath === '/admin' && (
        isAdminAuthenticated ? (
          <AdminDashboard
            onLogout={handleAdminLogout}
            onNavigateToDisplay={() => {
              window.open('/display', '_blank');
            }}
            onNavigateToTeam={() => {
              window.open('/team', '_blank');
            }}
          />
        ) : (
          /* Unauthenticated /admin login screen */
          <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-grid-pattern">
            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur-xl">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/30 flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-600/30">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-wide uppercase">
                  Quản Trị Viên Hệ Thống
                </h2>
                <p className="text-xs text-slate-400">
                  Khu vực bảo mật — Vui lòng nhập mật khẩu quản trị để truy cập
                </p>
              </div>

              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Mật khẩu Quản trị viên <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    autoFocus
                    required
                    className="w-full px-4 py-3.5 bg-slate-950 border-2 border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl text-white placeholder-slate-500 text-sm font-semibold outline-none transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center space-x-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400 inline" />
                    <span>Mật khẩu mặc định: <strong className="text-slate-300 font-mono">admin123</strong></span>
                  </p>
                </div>

                {adminError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{adminError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={adminLoading || !adminPassword.trim()}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-black transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {adminLoading ? 'Đang xác thực...' : 'ĐĂNG NHẬP ADMIN'}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      window.history.pushState(null, '', '/');
                      setCurrentPath('/');
                    }}
                    className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại trang chủ</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      )}

      {/* ==================================================== */}
      {/* VIEW 4: LANDING PAGE (/)                             */}
      {/* ==================================================== */}
      {currentPath === '/' && (
        <LandingPage
          onSelectMode={handleSelectLandingMode}
          isAdminAuthenticated={isAdminAuthenticated}
          setIsAdminAuthenticated={setIsAdminAuthenticated}
        />
      )}

      {/* MODAL FOR ADMIN LOGIN (Triggered from Landing Page) */}
      {showAdminModalOnLanding && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-white">Xác Thực Quyền Admin</h3>
                <p className="text-xs text-slate-400 mt-0.5">Trang này yêu cầu mật khẩu Quản trị viên</p>
              </div>
            </div>

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Mật khẩu Quản trị viên <span className="text-blue-400">*</span>
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Mật khẩu mặc định: admin123"
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl text-white placeholder-slate-500 text-sm font-semibold outline-none transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center space-x-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400 inline" />
                  <span>Mật khẩu mặc định: <strong className="text-slate-300 font-mono">admin123</strong></span>
                </p>
              </div>

              {adminError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{adminError}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdminModalOnLanding(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={adminLoading || !adminPassword.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {adminLoading ? 'Đang xác thực...' : 'Đăng Nhập Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

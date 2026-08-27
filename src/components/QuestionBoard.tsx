import React from 'react';
import {
  HelpCircle,
  BookOpen,
  Trophy,
  Target,
  Lightbulb,
  Search,
  Cpu,
  Award,
  Zap,
  Flame,
  Compass,
  Sparkles,
  Brain,
  Atom,
  Rocket,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export interface QuestionThemeConfig {
  number: number;
  name: string;
  gradient: string;
  border: string;
  hoverBorder: string;
  glow: string;
  hoverGlow: string;
  accentText: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const QUESTION_THEMES: Record<number, QuestionThemeConfig> = {
  1: {
    number: 1,
    name: 'CÂU 01',
    gradient: 'from-blue-600 via-indigo-600 to-cyan-500',
    border: 'border-cyan-400/40',
    hoverBorder: 'hover:border-cyan-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(6,182,212,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(6,182,212,0.6)]',
    accentText: 'text-cyan-200',
    icon: HelpCircle,
  },
  2: {
    number: 2,
    name: 'CÂU 02',
    gradient: 'from-emerald-600 via-teal-600 to-green-500',
    border: 'border-emerald-400/40',
    hoverBorder: 'hover:border-emerald-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(16,185,129,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(16,185,129,0.6)]',
    accentText: 'text-emerald-200',
    icon: BookOpen,
  },
  3: {
    number: 3,
    name: 'CÂU 03',
    gradient: 'from-amber-600 via-orange-600 to-yellow-500',
    border: 'border-amber-400/40',
    hoverBorder: 'hover:border-amber-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(245,158,11,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(245,158,11,0.6)]',
    accentText: 'text-amber-200',
    icon: Trophy,
  },
  4: {
    number: 4,
    name: 'CÂU 04',
    gradient: 'from-purple-600 via-violet-600 to-indigo-500',
    border: 'border-purple-400/40',
    hoverBorder: 'hover:border-purple-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(168,85,247,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(168,85,247,0.6)]',
    accentText: 'text-purple-200',
    icon: Target,
  },
  5: {
    number: 5,
    name: 'CÂU 05',
    gradient: 'from-rose-600 via-pink-600 to-red-500',
    border: 'border-pink-400/40',
    hoverBorder: 'hover:border-pink-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(244,63,94,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(244,63,94,0.6)]',
    accentText: 'text-pink-200',
    icon: Lightbulb,
  },
  6: {
    number: 6,
    name: 'CÂU 06',
    gradient: 'from-indigo-600 via-blue-700 to-sky-500',
    border: 'border-indigo-400/40',
    hoverBorder: 'hover:border-indigo-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(99,102,241,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(99,102,241,0.6)]',
    accentText: 'text-indigo-200',
    icon: Search,
  },
  7: {
    number: 7,
    name: 'CÂU 07',
    gradient: 'from-cyan-600 via-teal-600 to-sky-400',
    border: 'border-cyan-400/40',
    hoverBorder: 'hover:border-cyan-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(6,182,212,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(6,182,212,0.6)]',
    accentText: 'text-cyan-200',
    icon: Cpu,
  },
  8: {
    number: 8,
    name: 'CÂU 08',
    gradient: 'from-blue-700 via-indigo-700 to-blue-500',
    border: 'border-blue-400/40',
    hoverBorder: 'hover:border-blue-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(59,130,246,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(59,130,246,0.6)]',
    accentText: 'text-blue-200',
    icon: Award,
  },
  9: {
    number: 9,
    name: 'CÂU 09',
    gradient: 'from-fuchsia-600 via-pink-700 to-rose-500',
    border: 'border-fuchsia-400/40',
    hoverBorder: 'hover:border-fuchsia-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(217,70,239,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(217,70,239,0.6)]',
    accentText: 'text-fuchsia-200',
    icon: Zap,
  },
  10: {
    number: 10,
    name: 'CÂU 10',
    gradient: 'from-orange-600 via-amber-600 to-red-500',
    border: 'border-orange-400/40',
    hoverBorder: 'hover:border-orange-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(249,115,22,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(249,115,22,0.6)]',
    accentText: 'text-orange-200',
    icon: Flame,
  },
  11: {
    number: 11,
    name: 'CÂU 11',
    gradient: 'from-violet-700 via-purple-700 to-fuchsia-500',
    border: 'border-violet-400/40',
    hoverBorder: 'hover:border-violet-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(139,92,246,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(139,92,246,0.6)]',
    accentText: 'text-violet-200',
    icon: Compass,
  },
  12: {
    number: 12,
    name: 'CÂU 12',
    gradient: 'from-yellow-600 via-amber-600 to-yellow-400',
    border: 'border-yellow-400/40',
    hoverBorder: 'hover:border-yellow-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(234,179,8,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(234,179,8,0.6)]',
    accentText: 'text-yellow-200',
    icon: Sparkles,
  },
  13: {
    number: 13,
    name: 'CÂU 13',
    gradient: 'from-emerald-600 via-lime-600 to-teal-500',
    border: 'border-lime-400/40',
    hoverBorder: 'hover:border-lime-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(132,204,22,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(132,204,22,0.6)]',
    accentText: 'text-lime-200',
    icon: Brain,
  },
  14: {
    number: 14,
    name: 'CÂU 14',
    gradient: 'from-sky-600 via-blue-600 to-indigo-500',
    border: 'border-sky-400/40',
    hoverBorder: 'hover:border-sky-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(14,165,233,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(14,165,233,0.6)]',
    accentText: 'text-sky-200',
    icon: Atom,
  },
  15: {
    number: 15,
    name: 'CÂU 15',
    gradient: 'from-teal-600 via-cyan-700 to-emerald-500',
    border: 'border-teal-400/40',
    hoverBorder: 'hover:border-teal-300',
    glow: 'shadow-[0_8px_25px_-6px_rgba(20,184,166,0.35)]',
    hoverGlow: 'hover:shadow-[0_12px_32px_-4px_rgba(20,184,166,0.6)]',
    accentText: 'text-teal-200',
    icon: Rocket,
  },
};

interface QuestionBoardProps {
  completedQuestionNumbers: number[];
  currentQuestionNumber?: number | null;
  onSelectQuestion?: (questionNumber: number) => void;
  isAdmin?: boolean;
  disabled?: boolean;
  size?: 'normal' | 'compact';
}

export const QuestionBoard: React.FC<QuestionBoardProps> = ({
  completedQuestionNumbers,
  currentQuestionNumber,
  onSelectQuestion,
  isAdmin = false,
  disabled = false,
  size = 'normal',
}) => {
  const completedCount = completedQuestionNumbers.length;
  const remainingCount = 15 - completedCount;
  const progressPercent = Math.round((completedCount / 15) * 100);

  return (
    <div className="space-y-6 md:space-y-8 my-auto animate-in fade-in zoom-in-[0.98] duration-300 max-w-5xl mx-auto w-full px-2 sm:px-4">
      {/* 2. Tiêu đề - Modern Game Show with glowing bloom and accent line */}
      <div className="text-center relative">
        {/* Soft background aura */}
        <div className="absolute left-1/2 -top-6 -translate-x-1/2 w-72 h-24 bg-cyan-500/15 blur-3xl rounded-full pointer-events-none" />

        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-cyan-200 drop-shadow-[0_2px_20px_rgba(56,189,248,0.4)] uppercase">
          BẢNG CHỌN CÂU HỎI
        </h2>

        {/* Thin glowing neon accent line */}
        <div className="relative flex items-center justify-center mt-3">
          <div className="h-[2px] w-36 sm:w-56 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
          <div className="absolute w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#38bdf8]" />
        </div>
      </div>

      {/* 7. Container bảng câu hỏi - Glassmorphism, 24px radius, soft cyan border */}
      <div className="relative rounded-[24px] md:rounded-[28px] bg-slate-950/70 border border-cyan-500/25 backdrop-blur-xl p-4 sm:p-6 md:p-8 shadow-[0_0_50px_-10px_rgba(6,182,212,0.2)] overflow-hidden">
        {/* Decorative corner glows */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* 8. 5x3 Grid of 15 Vibrant Question Cards */}
        <div className="grid grid-cols-5 gap-2.5 sm:gap-3.5 md:gap-4 relative z-10">
          {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => {
            const isCompleted = completedQuestionNumbers.includes(num);
            const isCurrent = currentQuestionNumber === num;
            const theme = QUESTION_THEMES[num] || QUESTION_THEMES[1];
            const IconComponent = theme.icon;

            // 5. Trạng thái đã hoàn thành - Professional Completed State (Không để khoảng đen trống)
            if (isCompleted) {
              return (
                <div
                  key={num}
                  className={`relative rounded-[16px] md:rounded-[20px] bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-900/80 border border-emerald-500/30 p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center shadow-inner overflow-hidden select-none transition-all duration-300 ${
                    size === 'compact' ? 'h-16 sm:h-20' : 'h-24 sm:h-28 md:h-32'
                  }`}
                >
                  {/* Subtle completed top highlight */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
                  
                  {/* Watermark completed icon */}
                  <CheckCircle2 className="absolute -bottom-1 -right-1 w-10 h-10 sm:w-14 sm:h-14 text-emerald-500/10 pointer-events-none" />

                  <span className="font-mono text-xs sm:text-sm md:text-base font-bold text-slate-400 tracking-wider">
                    CÂU {String(num).padStart(2, '0')}
                  </span>

                  <div className="mt-1 sm:mt-1.5 flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-[9px] sm:text-[10px] md:text-xs font-extrabold text-emerald-400 shadow-sm">
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">ĐÃ CHỌN</span>
                  </div>
                </div>
              );
            }

            // Trạng thái khả dụng (chưa chọn) - Interactive / Display
            const cardContent = (
              <>
                {/* 3. Highlight ánh sáng ở cạnh trên */}
                <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
                
                {/* Shimmer sweep effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* 6. Icon minh họa mờ 20-30% ở góc phải */}
                <IconComponent className="absolute -bottom-1.5 -right-1.5 w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white/20 group-hover:text-white/30 group-hover:scale-110 transition-all duration-300 pointer-events-none" />

                {/* Question Label in center */}
                <span className="relative z-10 font-mono text-sm sm:text-lg md:text-2xl font-black text-white tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform duration-200">
                  CÂU {String(num).padStart(2, '0')}
                </span>

                {/* Admin Active question badge */}
                {isCurrent && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9] animate-ping" />
                )}
              </>
            );

            // If Admin can click to choose question
            if (isAdmin && onSelectQuestion) {
              return (
                <button
                  key={num}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectQuestion(num)}
                  className={`group relative rounded-[16px] md:rounded-[20px] bg-gradient-to-br ${theme.gradient} border ${theme.border} ${theme.hoverBorder} p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center ${theme.glow} ${theme.hoverGlow} cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
                    size === 'compact' ? 'h-16 sm:h-20' : 'h-24 sm:h-28 md:h-32'
                  } ${isCurrent ? 'ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-950 scale-105' : ''}`}
                >
                  {cardContent}
                </button>
              );
            }

            // Display Screen or Team Screen (View-only interactive cards)
            return (
              <div
                key={num}
                className={`group relative rounded-[16px] md:rounded-[20px] bg-gradient-to-br ${theme.gradient} border ${theme.border} ${theme.hoverBorder} p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center text-center ${theme.glow} ${theme.hoverGlow} overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] ${
                  size === 'compact' ? 'h-16 sm:h-20' : 'h-24 sm:h-28 md:h-32'
                }`}
              >
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

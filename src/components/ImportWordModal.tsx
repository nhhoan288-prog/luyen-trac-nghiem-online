import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Download,
  Trash2,
  RefreshCw,
  X,
  Plus,
  ArrowRight,
  Layers,
  Sparkles,
  BookOpen,
  Eye,
  Filter,
  Star,
  FileCheck,
  FolderOpen
} from 'lucide-react';
import {
  parseDocxFile,
  parseQuestionsFromRawText,
  parseMultipleFiles,
  downloadSampleDocxTemplate,
  ParsedQuestionItem,
  ParseResult,
} from '../services/docxParser';
import { AnswerOption } from '../types';

interface ImportWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (
    questions: ParsedQuestionItem[],
    mode: 'REPLACE' | 'APPEND',
    resetSessions: boolean
  ) => Promise<void>;
}

export const ImportWordModal: React.FC<ImportWordModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE' | 'GUIDE'>('FILE');
  const [rawText, setRawText] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsedList, setParsedList] = useState<ParsedQuestionItem[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');

  // Settings
  const [importMode, setImportMode] = useState<'REPLACE' | 'APPEND'>('REPLACE');
  const [defaultCategory, setDefaultCategory] = useState<string>('Tổng hợp');
  const [defaultPoints, setDefaultPoints] = useState<number>(0.6);
  const [resetSessions, setResetSessions] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle Multi-File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray: File[] = Array.from(files) as File[];
    setSelectedFiles(fileArray);
    setErrorMessage(null);
    setIsParsing(true);

    try {
      if (fileArray.length === 1) {
        const file = fileArray[0];
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || lowerName.endsWith('.dot')) {
          const result = await parseDocxFile(file, defaultCategory, defaultPoints);
          setParseResult(result);
          setParsedList(result.questions);
        } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.csv')) {
          const text = await file.text();
          const result = parseQuestionsFromRawText(text, defaultCategory, defaultPoints);
          setParseResult(result);
          setParsedList(result.questions);
        } else if (lowerName.endsWith('.json')) {
          const res = await parseMultipleFiles([file], defaultCategory, defaultPoints);
          setParseResult(res);
          setParsedList(res.questions);
        } else {
          setErrorMessage('Định dạng file không hỗ trợ. Vui lòng chọn .docx, .doc, .dot, .txt, .csv hoặc .json');
        }
      } else {
        // Multi-file batch processing
        const res = await parseMultipleFiles(fileArray, defaultCategory, defaultPoints, (curr, tot, name) => {
          setBatchProgress({ current: curr, total: tot, name });
        });
        setParseResult(res);
        setParsedList(res.questions);
      }
    } catch (err: any) {
      console.error('Error parsing files:', err);
      setErrorMessage(err.message || 'Lỗi khi phân tích file. Vui lòng kiểm tra định dạng file.');
    } finally {
      setIsParsing(false);
      setBatchProgress(null);
    }
  };

  // Handle Paste Parse
  const handleParseRawText = () => {
    if (!rawText.trim()) {
      setErrorMessage('Vui lòng dán nội dung văn bản câu hỏi vào khung bên dưới.');
      return;
    }
    setErrorMessage(null);
    setIsParsing(true);
    try {
      const result = parseQuestionsFromRawText(rawText, defaultCategory, defaultPoints);
      setParseResult(result);
      setParsedList(result.questions);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi phân tích cú pháp văn bản.');
    } finally {
      setIsParsing(false);
    }
  };

  // Update a single question in preview
  const handleUpdateQuestion = (index: number, updates: Partial<ParsedQuestionItem>) => {
    setParsedList((prev) => {
      const copy = [...prev];
      const updatedItem = { ...copy[index], ...updates };

      // Re-evaluate validity
      const warnings: string[] = [];
      let isValid = true;
      if (!updatedItem.content.trim()) {
        isValid = false;
        warnings.push('Thiếu nội dung câu hỏi');
      }
      if (!updatedItem.option_a.trim()) {
        isValid = false;
        warnings.push('Thiếu phương án A');
      }
      if (!updatedItem.option_b.trim()) {
        isValid = false;
        warnings.push('Thiếu phương án B');
      }
      updatedItem.isValid = isValid;
      updatedItem.warnings = warnings;

      copy[index] = updatedItem;
      return copy;
    });
  };

  const handleDeleteQuestion = (index: number) => {
    setParsedList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (parsedList.length === 0) {
      setErrorMessage('Chưa có câu hỏi nào được nạp. Vui lòng chọn file Word hoặc dán văn bản.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmImport(parsedList, importMode, resetSessions);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi lưu câu hỏi vào hệ thống.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List based on tab
  const filteredList = parsedList.filter((q) => {
    if (filterMode === 'VALID') return q.isValid && q.warnings.length === 0;
    if (filterMode === 'WARNING') return q.warnings.length > 0 && q.isValid;
    if (filterMode === 'ERROR') return !q.isValid;
    return true;
  });

  const validCount = parsedList.filter((q) => q.isValid && q.warnings.length === 0).length;
  const warningCount = parsedList.filter((q) => q.warnings.length > 0 && q.isValid).length;
  const errorCount = parsedList.filter((q) => !q.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-300 via-white to-purple-300 bg-clip-text text-transparent">
                NHẬP ĐỀ THI TỰ ĐỘNG THÔNG MINH
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Hỗ trợ Word (.docx, .doc, .dot), Text (.txt, .csv), JSON & Nạp nhiều file đồng thời
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('FILE')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all ${
              activeTab === 'FILE'
                ? 'bg-blue-600/20 text-cyan-400 border-b-2 border-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Tải File Word / Multi-Files
          </button>
          <button
            onClick={() => setActiveTab('PASTE')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all ${
              activeTab === 'PASTE'
                ? 'bg-purple-600/20 text-purple-300 border-b-2 border-purple-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Dán Văn Bản Trực Tiếp
          </button>
          <button
            onClick={() => setActiveTab('GUIDE')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all ${
              activeTab === 'GUIDE'
                ? 'bg-emerald-600/20 text-emerald-300 border-b-2 border-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Hướng Dẫn Mẫu Đề
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm animate-shake">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* TAB 1: FILE UPLOAD & MULTI-FILE */}
          {activeTab === 'FILE' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/80 bg-slate-800/40 hover:bg-slate-800/80 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group shadow-inner"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.dot,.txt,.csv,.json"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 group-hover:scale-110 flex items-center justify-center transition-transform duration-300 mb-4 border border-cyan-500/30 shadow-lg">
                  <FolderOpen className="w-8 h-8 text-cyan-400 group-hover:text-cyan-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                  KÉO FILE WORD VÀO ĐÂY HỎAC CLICK ĐỂ CHỌN FILE
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Hỗ trợ định dạng <span className="text-cyan-400 font-semibold">.DOCX, .DOC, .DOT, .TXT, .CSV, .JSON</span> (Có thể chọn nhiều file cùng lúc)
                </p>
              </div>

              {/* Parsing Loading indicator */}
              {isParsing && (
                <div className="p-4 rounded-2xl bg-blue-900/30 border border-blue-500/30 flex items-center gap-3 text-cyan-300">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span className="text-sm font-medium">
                    {batchProgress
                      ? `Đang xử lý ${batchProgress.current}/${batchProgress.total}: ${batchProgress.name}...`
                      : 'Đang đọc và phân tích cấu trúc file Word thông minh...'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PASTE RAW TEXT */}
          {activeTab === 'PASTE' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Dán nội dung câu hỏi từ Word / PDF vào đây:
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Ví dụ:\n\nKHOA TRIẾT HỌC MÁC - LÊNIN\n\nCâu 1: Chủ nghĩa duy tâm có mấy hình thức cơ bản?\na. 3\nb. 2\nc. 4\nd. 5\nĐáp án b\n\nCâu 2: Triết học ra đời trong điều kiện nào?\na. Xã hội phân chia giai cấp\nb. Tư duy phát triển...\nĐáp án c`}
                  className="w-full h-52 bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 custom-scrollbar resize-none"
                />
              </div>

              <button
                onClick={handleParseRawText}
                disabled={isParsing || !rawText.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-sm text-white shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isParsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                PHÂN TÍCH NỘI DUNG VĂN BẢN
              </button>
            </div>
          )}

          {/* TAB 3: TEMPLATE & GUIDE */}
          {activeTab === 'GUIDE' && (
            <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Cấu trúc Word được hỗ trợ tự động:
                </h4>
                <button
                  onClick={downloadSampleDocxTemplate}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Tải File Mẫu Word
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-cyan-400">Kiểu 1: Có từ khóa "Đáp án: X"</span>
                  <pre className="text-[11px] text-slate-400 font-mono bg-slate-950 p-2 rounded-lg">
{`Câu 1: Triết học là gì?
a. Khoa học của mọi khoa học
b. Hệ thống lý luận chung...
c. Khoa học tự nhiên
d. Tất cả các phương án
Đáp án b`}
                  </pre>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-purple-400">Kiểu 2: In đậm / Bôi đỏ / Tick ✓</span>
                  <pre className="text-[11px] text-slate-400 font-mono bg-slate-950 p-2 rounded-lg">
{`Câu 2. Quyền bầu cử là?
a. Quyền kinh tế
b. Quyền văn hóa
c. Quyền dân sự, chính trị (Bôi đậm)
d. Cả 3 phương án`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW CONTAINER */}
          {parsedList.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-800 animate-fadeIn">
              
              {/* Preview Stats Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 uppercase tracking-wide">
                      DANH SÁCH {parsedList.length} CÂU HỎI NHẬN DIỆN ĐƯỢC
                    </h4>
                    <p className="text-xs text-slate-400">Bạn có thể trực tiếp sửa câu hỏi, phương án & đáp án đúng bên dưới</p>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setFilterMode('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      filterMode === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tất cả ({parsedList.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('VALID')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                      filterMode === 'VALID' ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/40' : 'text-emerald-400 hover:bg-emerald-950/40'
                    }`}
                  >
                    ✓ Hợp lệ ({validCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('WARNING')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                      filterMode === 'WARNING' ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/40' : 'text-amber-400 hover:bg-amber-950/40'
                    }`}
                  >
                    ⚠ Cần kiểm tra ({warningCount})
                  </button>
                  {errorCount > 0 && (
                    <button
                      onClick={() => setFilterMode('ERROR')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                        filterMode === 'ERROR' ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/40' : 'text-rose-400 hover:bg-rose-950/40'
                      }`}
                    >
                      ❌ Lỗi ({errorCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {filteredList.map((item, index) => {
                  const realIndex = parsedList.findIndex((q) => q.tempId === item.tempId);
                  return (
                    <div
                      key={item.tempId}
                      className={`p-4 rounded-2xl border transition-all ${
                        !item.isValid
                          ? 'bg-rose-950/20 border-rose-500/40'
                          : item.warnings.length > 0
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Header of Question */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                            {index + 1}
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium">
                            {item.category || defaultCategory}
                          </span>
                          {item.sourceFileName && (
                            <span className="text-[11px] text-cyan-400/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                              {item.sourceFileName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 font-semibold">Đ/ÁN:</span>
                            <select
                              value={item.correct_answer}
                              onChange={(e) =>
                                handleUpdateQuestion(realIndex, {
                                  correct_answer: e.target.value as AnswerOption,
                                  isAnswerDetected: true,
                                })
                              }
                              className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                            >
                              <option value="A">Đáp án A</option>
                              <option value="B">Đáp án B</option>
                              {item.option_c && <option value="C">Đáp án C</option>}
                              {item.option_d && <option value="D">Đáp án D</option>}
                              {item.option_e && <option value="E">Đáp án E</option>}
                              {item.option_f && <option value="F">Đáp án F</option>}
                            </select>
                          </div>

                          <button
                            onClick={() => handleDeleteQuestion(realIndex)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Question Content Input */}
                      <input
                        type="text"
                        value={item.content}
                        onChange={(e) => handleUpdateQuestion(realIndex, { content: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus:border-cyan-500 mb-3"
                        placeholder="Nội dung câu hỏi..."
                      />

                      {/* Options Grid (Supports A, B, C, D, E, F) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div className={`flex items-center gap-2 p-2 rounded-xl border ${item.correct_answer === 'A' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                          <span className="w-6 h-6 rounded-lg bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300">A</span>
                          <input
                            type="text"
                            value={item.option_a}
                            onChange={(e) => handleUpdateQuestion(realIndex, { option_a: e.target.value })}
                            className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                            placeholder="Phương án A..."
                          />
                        </div>

                        <div className={`flex items-center gap-2 p-2 rounded-xl border ${item.correct_answer === 'B' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                          <span className="w-6 h-6 rounded-lg bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300">B</span>
                          <input
                            type="text"
                            value={item.option_b}
                            onChange={(e) => handleUpdateQuestion(realIndex, { option_b: e.target.value })}
                            className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                            placeholder="Phương án B..."
                          />
                        </div>

                        <div className={`flex items-center gap-2 p-2 rounded-xl border ${item.correct_answer === 'C' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                          <span className="w-6 h-6 rounded-lg bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300">C</span>
                          <input
                            type="text"
                            value={item.option_c}
                            onChange={(e) => handleUpdateQuestion(realIndex, { option_c: e.target.value })}
                            className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                            placeholder="Phương án C (nếu có)..."
                          />
                        </div>

                        <div className={`flex items-center gap-2 p-2 rounded-xl border ${item.correct_answer === 'D' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                          <span className="w-6 h-6 rounded-lg bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300">D</span>
                          <input
                            type="text"
                            value={item.option_d}
                            onChange={(e) => handleUpdateQuestion(realIndex, { option_d: e.target.value })}
                            className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                            placeholder="Phương án D (nếu có)..."
                          />
                        </div>

                        {item.option_e !== undefined && (
                          <div className={`flex items-center gap-2 p-2 rounded-xl border ${item.correct_answer === 'E' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                            <span className="w-6 h-6 rounded-lg bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300">E</span>
                            <input
                              type="text"
                              value={item.option_e}
                              onChange={(e) => handleUpdateQuestion(realIndex, { option_e: e.target.value })}
                              className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                              placeholder="Phương án E..."
                            />
                          </div>
                        )}

                        {item.option_f !== undefined && (
                          <div className={`flex items-center gap-2 p-2 rounded-xl border ${item.correct_answer === 'F' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                            <span className="w-6 h-6 rounded-lg bg-slate-800 font-bold text-xs flex items-center justify-center text-slate-300">F</span>
                            <input
                              type="text"
                              value={item.option_f}
                              onChange={(e) => handleUpdateQuestion(realIndex, { option_f: e.target.value })}
                              className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                              placeholder="Phương án F..."
                            />
                          </div>
                        )}
                      </div>

                      {/* Warnings / Status Message */}
                      {item.warnings.length > 0 && (
                        <div className="mt-2.5 text-[11px] text-amber-400 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {item.warnings.join(' • ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CONFIGURATION OPTIONS */}
          <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" /> Cấu Hình Nạp Đề Thi Vòng Thi:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Chế độ lưu vào Ngân hàng:</label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as 'REPLACE' | 'APPEND')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="REPLACE">Thay thế toàn bộ ngân hàng câu hỏi cũ</option>
                  <option value="APPEND">Thêm nối tiếp vào ngân hàng câu hỏi hiện tại</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Danh mục / Chủ đề mặc định:</label>
                <input
                  type="text"
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-semibold focus:outline-none focus:border-blue-500"
                  placeholder="VD: Lý thuyết chung"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Điểm mỗi câu hỏi:</label>
                <input
                  type="number"
                  step="0.1"
                  value={defaultPoints}
                  onChange={(e) => setDefaultPoints(parseFloat(e.target.value) || 0.6)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={resetSessions}
                onChange={(e) => setResetSessions(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900 cursor-pointer"
              />
              <span className="font-semibold text-cyan-300">Tự động đặt lại bài làm của Thí sinh sau khi nạp đề mới</span>
            </label>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-sm transition-colors"
          >
            Hủy Bỏ
          </button>

          <button
            onClick={handleConfirm}
            disabled={isSubmitting || parsedList.length === 0}
            className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 font-bold text-sm text-white shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Đang Lưu Vào Hệ Thống...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                XÁC NHẬN NẠP {parsedList.length} CÂU HỎI
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

import JSZip from 'jszip';
import mammoth from 'mammoth';
import { AnswerOption } from '../types';

export interface ParsedQuestionItem {
  tempId: string;
  question_number: number;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  option_f?: string;
  options_count?: number;
  correct_answer: AnswerOption;
  explanation?: string;
  category?: string;
  points?: number;
  time_limit?: number;
  difficulty?: number;
  image_url?: string;
  table_html?: string;
  isValid: boolean;
  isAnswerDetected: boolean;
  warnings: string[];
  sourceFileName?: string;
}

export interface ParseResult {
  questions: ParsedQuestionItem[];
  totalParsed: number;
  validCount: number;
  warningCount: number;
  rawText: string;
}

interface RunInfo {
  text: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isRed: boolean;
  isYellow: boolean;
}

interface ParagraphInfo {
  text: string;
  runs: RunInfo[];
  hasBoldRun: boolean;
  hasItalicRun: boolean;
  hasUnderlineRun: boolean;
  hasRedRun: boolean;
  hasYellowRun: boolean;
  isListItem?: boolean;
}

/**
 * Checks if a color hex code or name is RED
 */
function isRedColor(val?: string | null): boolean {
  if (!val) return false;
  const clean = val.trim().toLowerCase();
  if (['red', 'darkred', 'crimson', 'c00000', 'ff0000', 'ed1c24', 'e53935', 'ff3333', 'ff0033'].includes(clean)) {
    return true;
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (r >= 160 && r > g + 35 && r > b + 35) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a highlight or background shading is YELLOW
 */
function isYellowHighlight(val?: string | null): boolean {
  if (!val) return false;
  const clean = val.trim().toLowerCase();
  if (['yellow', 'lightyellow', 'ffff00', 'fff200', 'fff59d', 'fff176', 'ffeb3b', 'fbc02d', 'ffe699'].includes(clean)) {
    return true;
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (r >= 190 && g >= 170 && b <= 140) {
      return true;
    }
  }
  return false;
}

/**
 * Normalizes text string
 */
function normalizeDocText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\t/g, '  ')
    .trim();
}

/**
 * Extracts bottom answer key section if present in the document
 */
function extractBottomAnswerKey(fullText: string): Map<number, AnswerOption> {
  const answerMap = new Map<number, AnswerOption>();
  const answerKeySectionMatch = fullText.match(
    /(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s+CHI\s+TIẾT|ANSWER\s+KEY|ĐÁP\s+ÁN\s*:\s*\n)([\s\S]*)$/i
  );

  const textToScan = answerKeySectionMatch ? answerKeySectionMatch[1] : fullText;
  const regex = /(?:Câu\s*)?(\d+)[\s.:\-\)]+([A-D|a-d])\b/g;
  let match;
  while ((match = regex.exec(textToScan)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase() as AnswerOption;
    answerMap.set(qNum, ans);
  }

  return answerMap;
}

/**
 * Core Parser that transforms ParagraphInfo list into structured Questions
 */
function parseParagraphsToQuestions(
  paragraphs: ParagraphInfo[],
  defaultCategory: string = 'Tổng hợp',
  defaultPoints: number = 0.6,
  fullTextFallback: string = ''
): ParseResult {
  const bottomAnswerMap = extractBottomAnswerKey(fullTextFallback);

  // 1. Determine Initial Category: look for header starting with 'KHOA ' or 'CHỦ ĐỀ '
  let detectedInitialCategory = defaultCategory;
  for (let i = 0; i < Math.min(paragraphs.length, 10); i++) {
    const l = paragraphs[i].text.trim();
    if (/^(?:khoa|chủ\s*đề|bộ\s*môn|phần|chương)\b/i.test(l)) {
      detectedInitialCategory = l.replace(/^[IVXLCDM]+\.\s*/i, '').trim();
      break;
    }
  }

  let currentCategory = detectedInitialCategory;

  interface RawQuestionBlock {
    questionNumber: number;
    category: string;
    contentLines: string[];
    options: {
      letter: string;
      text: string;
      isBold: boolean;
      isItalic: boolean;
      isUnderline: boolean;
      isRed: boolean;
      isYellow: boolean;
      hasAsterisk: boolean;
    }[];
    explicitAnswer?: AnswerOption;
    explanation?: string;
  }

  const blocks: RawQuestionBlock[] = [];
  let currentBlock: RawQuestionBlock | null = null;
  let questionCounter = 1;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const line = p.text.trim();
    if (!line) continue;

    // 1. Check if line is a Category Header
    // STRICT match to prevent option text like "Cả a, b, c" from becoming category
    if (/^(?:khoa|chủ\s*đề|bộ\s*môn|phần\s+\d+|chương\s+\d+)\s+([^\n]{3,60})$/i.test(line)) {
      currentCategory = line.trim();
      continue;
    }

    // 2. Check Question Start (e.g. "Câu 1:", "Câu 1.", "Câu 1 -", "1.", "1)")
    const qMatch =
      line.match(/^(?:câu|question|bài|cau)\s*(\d+)[\s.:\-\)]+\s*(.*)$/i) ||
      (/^\d+[\s.:\-\)]+\s+/.test(line) && !/^(?:đáp|trả|giải|[a-e][.:\)])/i.test(line)
        ? line.match(/^(\d+)[\s.:\-\)]+\s*(.*)$/)
        : null);

    if (qMatch) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }

      const parsedNum = parseInt(qMatch[1], 10) || questionCounter;
      const cleanTitle = qMatch[2] ? qMatch[2].trim() : '';

      currentBlock = {
        questionNumber: parsedNum,
        category: currentCategory,
        contentLines: cleanTitle ? [cleanTitle] : [],
        options: [],
      };
      questionCounter++;
      continue;
    }

    if (!currentBlock) {
      // Ignore pre-header text or lines before first question
      continue;
    }

    // 3. Check Explicit Answer Line (e.g. "Đáp án b", "Trả lời: Đáp án D", "Đ/A: A", "Key: A")
    const ansMatch = line.match(
      /(?:trả\s*lời\s*[:=\-]?\s*)?(?:đáp\s*án(?:\s*đúng)?(?:\s*là)?|đ\/?á?n|key|answer(?:\s*is)?)\s*[:=\-]?\s*([A-E|a-e])\b/i
    );
    if (ansMatch) {
      currentBlock.explicitAnswer = ansMatch[1].toUpperCase() as AnswerOption;
      continue;
    }

    // 4. Check Explanation Line
    const expMatch = line.match(/^(?:giải\s*thích|lời\s*giải|explanation)\s*[:=\-]?\s*(.*)$/i);
    if (expMatch) {
      currentBlock.explanation = expMatch[1].trim();
      continue;
    }

    // 5. Check Option Line
    // Case 5A: Single option starting with letter a-e: e.g. "a. 3", "a) Nội dung", "A.Năm 1920", "*a. Nội dung", "e. Tất cả..."
    const singleOptMatch = line.match(/^(\*?)([a-eA-E])(\*?)[\s.:)/\]]+\s*(.*)$/);
    if (singleOptMatch) {
      const letter = singleOptMatch[2].toUpperCase();
      const hasAst = singleOptMatch[1] === '*' || singleOptMatch[3] === '*';
      const optText = singleOptMatch[4].trim();

      // Check if line contains multiple options: e.g. "A. 3   B. 2   C. 4   D. 5"
      const multiRegex =
        /(?:^|\s{2,}|\t)(\*?)([A-Ea-e])(\*?)[\s.:)/\]]+\s*([^\t]+?)(?=(?:\s{2,}|\t)\*?[A-Ea-e]\*?[\s.:)/\]]+|$)/g;
      const multiMatches: {
        letter: string;
        text: string;
        hasAst: boolean;
      }[] = [];

      let mm;
      while ((mm = multiRegex.exec(line)) !== null) {
        multiMatches.push({
          letter: mm[2].toUpperCase(),
          text: mm[4].trim(),
          hasAst: mm[1] === '*' || mm[3] === '*',
        });
      }

      if (multiMatches.length >= 2) {
        multiMatches.forEach((mItem) => {
          currentBlock!.options.push({
            letter: mItem.letter,
            text: mItem.text,
            isBold: p.hasBoldRun,
            isItalic: p.hasItalicRun,
            isUnderline: p.hasUnderlineRun,
            isRed: p.hasRedRun,
            isYellow: p.hasYellowRun,
            hasAsterisk: mItem.hasAst,
          });
        });
      } else {
        currentBlock.options.push({
          letter,
          text: optText,
          isBold: p.hasBoldRun,
          isItalic: p.hasItalicRun,
          isUnderline: p.hasUnderlineRun,
          isRed: p.hasRedRun,
          isYellow: p.hasYellowRun,
          hasAsterisk: hasAst,
        });
      }
      continue;
    }

    // Case 5B: Numbered / Bulleted list item from Word XML (<w:numPr>) OR standalone option without letter prefix (e.g. Question 19 in K5.docx)
    if (
      p.isListItem ||
      (currentBlock.contentLines.length > 0 &&
        currentBlock.options.length < 5 &&
        line.length < 250 &&
        !/^(?:câu|question|bài|cau|đáp|trả|giải)/i.test(line))
    ) {
      const nextLetters = ['A', 'B', 'C', 'D', 'E'];
      const nextLetter = nextLetters[currentBlock.options.length] || 'D';

      currentBlock.options.push({
        letter: nextLetter,
        text: line,
        isBold: p.hasBoldRun,
        isItalic: p.hasItalicRun,
        isUnderline: p.hasUnderlineRun,
        isRed: p.hasRedRun,
        isYellow: p.hasYellowRun,
        hasAsterisk: false,
      });
      continue;
    }

    // 6. Continued lines
    if (currentBlock.options.length > 0) {
      currentBlock.options[currentBlock.options.length - 1].text += ' ' + line;
    } else {
      currentBlock.contentLines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Transform raw blocks to ParsedQuestionItem
  const parsedQuestions: ParsedQuestionItem[] = blocks.map((block, idx) => {
    const warnings: string[] = [];

    const content = block.contentLines.join(' ').trim();
    let option_a = '';
    let option_b = '';
    let option_c = '';
    let option_d = '';
    let option_e: string | undefined = undefined;
    let option_f: string | undefined = undefined;

    const totalOpts = Math.max(block.options.length, 2);

    if (block.options.length >= 2) {
      option_a = block.options[0]?.text || '';
      option_b = block.options[1]?.text || '';
      if (block.options.length >= 3) option_c = block.options[2]?.text || '';
      if (block.options.length >= 4) option_d = block.options[3]?.text || '';
      if (block.options.length >= 5) option_e = block.options[4]?.text || '';
      if (block.options.length >= 6) option_f = block.options[5]?.text || '';
    } else {
      const getOpt = (l: string) => block.options.find((o) => o.letter === l)?.text || '';
      option_a = getOpt('A') || (block.options[0] ? block.options[0].text : '');
      option_b = getOpt('B') || (block.options[1] ? block.options[1].text : '');
      option_c = getOpt('C') || (block.options[2] ? block.options[2].text : '');
      option_d = getOpt('D') || (block.options[3] ? block.options[3].text : '');
      option_e = getOpt('E') || (block.options[4] ? block.options[4].text : undefined);
      option_f = getOpt('F') || (block.options[5] ? block.options[5].text : undefined);
    }

    // Clean checkmark ✓ from option text if present
    const cleanCheckmark = (t: string) => t.replace(/[\s*_]*[✓✔☑][\s*_]*/g, '').trim();
    option_a = cleanCheckmark(option_a);
    option_b = cleanCheckmark(option_b);
    option_c = cleanCheckmark(option_c);
    option_d = cleanCheckmark(option_d);
    if (option_e) option_e = cleanCheckmark(option_e);
    if (option_f) option_f = cleanCheckmark(option_f);

    // Determine Correct Answer
    let isAnswerDetected = true;
    let correctAnswer: AnswerOption | null = block.explicitAnswer || null;

    if (!correctAnswer) {
      // 1. Check checkmark ✓ or asterisk * in option text
      const checkOpt = block.options.find((o) => o.hasAsterisk || /[✓✔☑]/.test(o.text));
      if (checkOpt) {
        const foundIdx = block.options.indexOf(checkOpt);
        correctAnswer = (['A', 'B', 'C', 'D', 'E', 'F'][foundIdx] || checkOpt.letter) as AnswerOption;
      }
    }

    if (!correctAnswer) {
      // 2. Check RED color
      const redOpts = block.options.filter((o) => o.isRed);
      if (redOpts.length === 1) {
        const foundIdx = block.options.indexOf(redOpts[0]);
        correctAnswer = (['A', 'B', 'C', 'D', 'E', 'F'][foundIdx] || redOpts[0].letter) as AnswerOption;
      }
    }

    if (!correctAnswer) {
      // 3. Check YELLOW highlight
      const yellowOpts = block.options.filter((o) => o.isYellow);
      if (yellowOpts.length === 1) {
        const foundIdx = block.options.indexOf(yellowOpts[0]);
        correctAnswer = (['A', 'B', 'C', 'D', 'E', 'F'][foundIdx] || yellowOpts[0].letter) as AnswerOption;
      }
    }

    if (!correctAnswer) {
      // 4. Check UNDERLINE
      const uOpts = block.options.filter((o) => o.isUnderline);
      if (uOpts.length === 1) {
        const foundIdx = block.options.indexOf(uOpts[0]);
        correctAnswer = (['A', 'B', 'C', 'D', 'E', 'F'][foundIdx] || uOpts[0].letter) as AnswerOption;
      }
    }

    if (!correctAnswer) {
      // 5. Check BOLD + ITALIC
      const boldItalicOpts = block.options.filter((o) => o.isBold && o.isItalic);
      if (boldItalicOpts.length === 1) {
        const foundIdx = block.options.indexOf(boldItalicOpts[0]);
        correctAnswer = (['A', 'B', 'C', 'D', 'E', 'F'][foundIdx] || boldItalicOpts[0].letter) as AnswerOption;
      }
    }

    if (!correctAnswer) {
      // 6. Check BOLD (when not all options are bold)
      const boldOpts = block.options.filter((o) => o.isBold);
      if (boldOpts.length === 1 && block.options.length > 1) {
        const foundIdx = block.options.indexOf(boldOpts[0]);
        correctAnswer = (['A', 'B', 'C', 'D', 'E', 'F'][foundIdx] || boldOpts[0].letter) as AnswerOption;
      }
    }

    if (!correctAnswer && bottomAnswerMap.has(block.questionNumber)) {
      // 7. Check bottom answer key map
      correctAnswer = bottomAnswerMap.get(block.questionNumber)!;
    }

    let isValid = true;
    if (!content) {
      isValid = false;
      warnings.push('Thiếu nội dung câu hỏi');
    }
    if (!option_a) {
      isValid = false;
      warnings.push('Thiếu phương án A');
    }
    if (!option_b) {
      isValid = false;
      warnings.push('Thiếu phương án B');
    }

    if (!correctAnswer) {
      isAnswerDetected = false;
      correctAnswer = 'A';
      warnings.push('Chưa xác định đáp án đúng (tạm đặt là A)');
    }

    return {
      tempId: `parsed_${idx + 1}_${Date.now()}`,
      question_number: idx + 1,
      content: content || `Câu hỏi số ${idx + 1}`,
      option_a: option_a || 'Phương án A',
      option_b: option_b || 'Phương án B',
      option_c: option_c || '',
      option_d: option_d || '',
      option_e,
      option_f,
      options_count: totalOpts,
      correct_answer: correctAnswer,
      explanation: block.explanation,
      category: block.category || defaultCategory,
      points: defaultPoints,
      time_limit: 15,
      isValid,
      isAnswerDetected,
      warnings,
    };
  });

  const validCount = parsedQuestions.filter((q) => q.isValid && q.warnings.length === 0).length;
  const warningCount = parsedQuestions.length - validCount;

  return {
    questions: parsedQuestions,
    totalParsed: parsedQuestions.length,
    validCount,
    warningCount,
    rawText: fullTextFallback,
  };
}

/**
 * Parses raw text input directly
 */
export function parseQuestionsFromRawText(
  rawInputText: string,
  defaultCategory: string = 'Tổng hợp',
  defaultPoints: number = 0.6
): ParseResult {
  const text = normalizeDocText(rawInputText);
  if (!text) {
    return {
      questions: [],
      totalParsed: 0,
      validCount: 0,
      warningCount: 0,
      rawText: '',
    };
  }

  const lines = text.split('\n');
  const paragraphs: ParagraphInfo[] = lines.map((l) => ({
    text: l,
    runs: [{ text: l, isBold: false, isItalic: false, isUnderline: false, isRed: false, isYellow: false }],
    hasBoldRun: false,
    hasItalicRun: false,
    hasUnderlineRun: false,
    hasRedRun: false,
    hasYellowRun: false,
    isListItem: false,
  }));

  return parseParagraphsToQuestions(paragraphs, defaultCategory, defaultPoints, text);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Extracts and parses questions from a .docx / .doc File object
 */
export async function parseDocxFile(
  file: File,
  defaultCategory: string = 'Tổng hợp',
  defaultPoints: number = 0.6
): Promise<ParseResult> {
  const isOldDoc = file.name.toLowerCase().endsWith('.doc') && !file.name.toLowerCase().endsWith('.docx');

  if (isOldDoc) {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(arrayBuffer);
    const res = await fetch('/api/questions/parse-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, fileName: file.name }),
    });

    const resText = await res.text();
    let data: any = {};
    try {
      data = resText ? JSON.parse(resText) : {};
    } catch {
      data = {};
    }

    if (!res.ok || !data.success) {
      if (!data.error && resText.includes('<!DOCTYPE')) {
        throw new Error(
          'Máy chủ Server cần được khởi động lại để kích hoạt bộ đọc file .doc. Hãy nhấn Ctrl+C ở màn hình chạy Server rồi gõ "npm run dev", HOẶC mở file trong Word rồi Save As thành .docx để nạp ngay!'
        );
      }
      throw new Error(data.error || data.message || `Lỗi máy chủ khi đọc file .doc (HTTP ${res.status})`);
    }

    if (data.isDocxConverted && data.docxBase64) {
      const binaryStr = window.atob(data.docxBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const convertedFile = new File([bytes.buffer], file.name.replace(/\.doc$/i, '.docx'), {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      return parseDocxFile(convertedFile, defaultCategory, defaultPoints);
    }

    return parseQuestionsFromRawText(data.rawText || '', defaultCategory, defaultPoints);
  }

  const arrayBuffer = await file.arrayBuffer();

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');

    if (docXmlFile) {
      const xmlContent = await docXmlFile.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

      const pElements = xmlDoc.getElementsByTagName('w:p');
      const paragraphs: ParagraphInfo[] = [];

      for (let pIdx = 0; pIdx < pElements.length; pIdx++) {
        const p = pElements[pIdx];
        const runs: RunInfo[] = [];
        let pFullText = '';

        let hasBold = false;
        let hasItalic = false;
        let hasUnderline = false;
        let hasRed = false;
        let hasYellow = false;

        const isListItem = p.getElementsByTagName('w:numPr').length > 0;

        const childNodes = p.childNodes;
        for (let cIdx = 0; cIdx < childNodes.length; cIdx++) {
          const node = childNodes[cIdx];
          if (node.nodeName === 'w:r') {
            const rElem = node as Element;
            const rPr = rElem.getElementsByTagName('w:rPr')[0];

            let isBold = false;
            let isItalic = false;
            let isUnderline = false;
            let isRed = false;
            let isYellow = false;

            if (rPr) {
              const b = rPr.getElementsByTagName('w:b')[0];
              const bCs = rPr.getElementsByTagName('w:bCs')[0];
              if (b || bCs) {
                const val = b?.getAttribute('w:val');
                if (val !== '0' && val !== 'false') isBold = true;
              }

              const i = rPr.getElementsByTagName('w:i')[0];
              const iCs = rPr.getElementsByTagName('w:iCs')[0];
              if (i || iCs) {
                const val = i?.getAttribute('w:val');
                if (val !== '0' && val !== 'false') isItalic = true;
              }

              const colorElem = rPr.getElementsByTagName('w:color')[0];
              if (colorElem && isRedColor(colorElem.getAttribute('w:val'))) {
                isRed = true;
              }

              const hlElem = rPr.getElementsByTagName('w:highlight')[0];
              if (hlElem && isYellowHighlight(hlElem.getAttribute('w:val'))) {
                isYellow = true;
              }
              const shdElem = rPr.getElementsByTagName('w:shd')[0];
              if (shdElem && isYellowHighlight(shdElem.getAttribute('w:fill'))) {
                isYellow = true;
              }

              const uElem = rPr.getElementsByTagName('w:u')[0];
              if (uElem && uElem.getAttribute('w:val') !== 'none') {
                isUnderline = true;
              }
            }

            const tElems = rElem.getElementsByTagName('w:t');
            let rText = '';
            for (let tIdx = 0; tIdx < tElems.length; tIdx++) {
              rText += tElems[tIdx].textContent || '';
            }

            if (rText) {
              pFullText += rText;
              runs.push({ text: rText, isBold, isItalic, isUnderline, isRed, isYellow });
              if (isBold) hasBold = true;
              if (isItalic) hasItalic = true;
              if (isUnderline) hasUnderline = true;
              if (isRed) hasRed = true;
              if (isYellow) hasYellow = true;
            }
          } else if (node.nodeName === 'w:tab') {
            pFullText += '  ';
          }
        }

        if (pFullText.trim()) {
          paragraphs.push({
            text: pFullText.trim(),
            runs,
            hasBoldRun: hasBold,
            hasItalicRun: hasItalic,
            hasUnderlineRun: hasUnderline,
            hasRedRun: hasRed,
            hasYellowRun: hasYellow,
            isListItem,
          });
        }
      }

      if (paragraphs.length > 0) {
        const fullRawText = paragraphs.map((p) => p.text).join('\n');
        return parseParagraphsToQuestions(paragraphs, defaultCategory, defaultPoints, fullRawText);
      }
    }
  } catch (err) {
    console.warn('XML direct parser warning, falling back to mammoth:', err);
  }

  // Fallback to mammoth plain text
  const mammothResult = await mammoth.extractRawText({ arrayBuffer });
  const rawText = mammothResult.value || '';
  return parseQuestionsFromRawText(rawText, defaultCategory, defaultPoints);
}

/**
 * Generates sample template for download
 */
export function downloadSampleDocxTemplate(): void {
  const sampleContent = `KHOA TRIẾT HỌC MÁC - LÊNIN
----------------------------------------------------------------------

Câu 1: Chủ nghĩa duy tâm có mấy hình thức cơ bản?
a. 3
b. 2
c. 4
d. 5
Đáp án b

Câu 2: Triết học là gì?
a. Khoa học của mọi khoa học
b. Hệ thống tri thức lý luận chung nhất về thế giới, về vị trí, vai trò của con người trong thế giới.
c. Khoa học nghiên cứu những quy luật chung nhất của tự nhiên.
d. Khoa học nghiên cứu về con người và sự nghiệp giải phóng con người ra khỏi mọi áp bức, bóc lột.
Đáp án b

Câu 3: Triết học ra đời trong điều kiện nào?
a. Xã hội phân chia thành giai cấp
b. Xuất hiện tầng lớp lao động trí óc
c. Tư duy của con người đạt trình độ tư duy khái quát cao và xuất hiện tầng lớp lao động trí óc có khả năng hệ thống tri thức của con người
d. Cả a, b, c
Đáp án c
`;

  const blob = new Blob([sampleContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Mau_De_Thi_Trac_Nghiem_Word.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses multiple files (docx, doc, dot, txt, json, csv, etc.) in batch mode with progress callback
 */
export async function parseMultipleFiles(
  files: File[],
  defaultCategory: string = 'Tổng hợp',
  defaultPoints: number = 0.6,
  onProgress?: (processed: number, total: number, fileName: string) => void
): Promise<ParseResult> {
  const allQuestions: ParsedQuestionItem[] = [];
  let combinedRawText = '';
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress(i + 1, total, file.name);
    }
    try {
      let res: ParseResult;
      const fName = file.name.toLowerCase();
      if (fName.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        const qList = Array.isArray(json) ? json : json.questions || [];
        res = {
          questions: qList.map((q: any, idx: number) => ({
            tempId: `json_${idx}_${Date.now()}`,
            question_number: idx + 1,
            content: q.content || q.title || '',
            option_a: q.option_a || q.options?.[0] || '',
            option_b: q.option_b || q.options?.[1] || '',
            option_c: q.option_c || q.options?.[2] || '',
            option_d: q.option_d || q.options?.[3] || '',
            option_e: q.option_e || q.options?.[4],
            option_f: q.option_f || q.options?.[5],
            correct_answer: (q.correct_answer || 'A').toUpperCase() as AnswerOption,
            explanation: q.explanation || '',
            category: q.category || defaultCategory,
            isValid: true,
            isAnswerDetected: true,
            warnings: []
          })),
          totalParsed: qList.length,
          validCount: qList.length,
          warningCount: 0,
          rawText: text
        };
      } else if (fName.endsWith('.txt') || fName.endsWith('.csv')) {
        const text = await file.text();
        res = parseQuestionsFromRawText(text, defaultCategory, defaultPoints);
      } else {
        res = await parseDocxFile(file, defaultCategory, defaultPoints);
      }

      const taggedQuestions = res.questions.map((q, idx) => ({
        ...q,
        sourceFileName: file.name,
        question_number: allQuestions.length + idx + 1,
        tempId: `multi_${i}_${q.tempId}`
      }));

      allQuestions.push(...taggedQuestions);
      combinedRawText += `\n--- FILE: ${file.name} ---\n` + res.rawText;
    } catch (err) {
      console.warn(`Error parsing file ${file.name}:`, err);
    }
  }

  const validCount = allQuestions.filter((q) => q.isValid && q.warnings.length === 0).length;
  const warningCount = allQuestions.length - validCount;

  return {
    questions: allQuestions,
    totalParsed: allQuestions.length,
    validCount,
    warningCount,
    rawText: combinedRawText
  };
}

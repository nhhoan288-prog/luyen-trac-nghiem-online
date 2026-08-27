import { db } from './database';
import {
  AnswerOption,
  AnswerSubmission,
  Question,
  QuestionResultItem,
  QuestionSession,
  QuestionSummaryResult,
  QuizState,
  SanitizedQuestion,
  TeamScoreStats,
} from './types';

export class QuizEngine {
  private activeTimer: NodeJS.Timeout | null = null;
  private serverSequenceCounter: number = 100;
  private onStateChangeCallback?: (state: QuizState, payload?: any) => void;
  private onTimeTickCallback?: (timeLeftSec: number, timeLeftMs: number) => void;
  private onAnswerReceivedCallback?: (answer: AnswerSubmission, totalAnswers: number) => void;
  private tickInterval: NodeJS.Timeout | null = null;
  private lastSummaryResult: QuestionSummaryResult | null = null;

  constructor() {
    // Check if recovery is needed on boot
    const comp = db.getCompetition();
    if (comp.state === 'RUNNING') {
      db.setQuizState('RECOVERY_REQUIRED');
      db.logEvent('SYSTEM_BOOT', 'Máy chủ vừa khởi động lại khi câu hỏi đang diễn ra. Chuyển sang chế độ yêu cầu xác nhận khôi phục.');
    }
  }

  public setEventCallbacks(callbacks: {
    onStateChange: (state: QuizState, payload?: any) => void;
    onTimeTick: (timeLeftSec: number, timeLeftMs: number) => void;
    onAnswerReceived: (answer: AnswerSubmission, totalAnswers: number) => void;
  }) {
    this.onStateChangeCallback = callbacks.onStateChange;
    this.onTimeTickCallback = callbacks.onTimeTick;
    this.onAnswerReceivedCallback = callbacks.onAnswerReceived;
  }

  public getState(): QuizState {
    return db.getCompetition().state;
  }

  public getCurrentQuestion(): Question | undefined {
    const comp = db.getCompetition();
    return db.getQuestionByIndex(comp.current_question_index);
  }

  public getSanitizedCurrentQuestion(): SanitizedQuestion | undefined {
    const q = this.getCurrentQuestion();
    if (!q) return undefined;
    return {
      id: q.id,
      question_number: q.question_number,
      content: q.content,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      time_limit: q.time_limit,
      points: q.points,
      image_url: q.image_url,
      question_type: q.question_type,
      category: q.category,
    };
  }

  public getCurrentSession(): QuestionSession | undefined {
    const comp = db.getCompetition();
    if (!comp.current_session_id) return undefined;
    return db.getSession(comp.current_session_id);
  }

  // --- ACTIONS ---

  /**
   * Show Question Board (15 slots)
   */
  public showQuestionBoard(): { success: boolean; completedQuestionNumbers: number[] } {
    this.clearTimers();
    db.setQuizState('QUESTION_BOARD');
    db.updateCompetition({
      state: 'QUESTION_BOARD',
      current_session_id: undefined,
      selected_team_id: undefined,
    });
    const completedQuestionNumbers = db.getCompletedQuestionNumbers();
    const completedQuestionIds = db.getCompletedQuestionIds();

    db.logEvent('SYSTEM_BOOT', 'Quản trị viên đã mở BẢNG 15 Ô CÂU HỎI.');

    this.onStateChangeCallback?.('QUESTION_BOARD', {
      completedQuestionNumbers,
      completedQuestionIds,
      totalQuestions: db.getQuestions().length,
    });

    return { success: true, completedQuestionNumbers };
  }

  /**
   * Admin selects a specific question (1..15)
   */
  public selectQuestion(
    questionNumberOrId: number | string,
    selectedTeamId?: string
  ): { success: boolean; question?: Question; error?: string } {
    this.clearTimers();
    const questions = db.getQuestions();
    const targetQ = db.getQuestion(questionNumberOrId);
    if (!targetQ) {
      return { success: false, error: `Không tìm thấy câu hỏi ${questionNumberOrId}` };
    }

    const completedNums = db.getCompletedQuestionNumbers();
    if (completedNums.includes(targetQ.question_number)) {
      return { success: false, error: `Câu hỏi số ${targetQ.question_number} đã hoàn thành, không thể chọn lại.` };
    }

    const targetIndex = questions.findIndex((q) => q.id === targetQ.id);
    if (targetIndex === -1) {
      return { success: false, error: 'Không tìm thấy vị trí câu hỏi' };
    }

    this.lastSummaryResult = null;
    db.updateCompetition({
      current_question_index: targetIndex,
      current_session_id: undefined,
      selected_team_id: selectedTeamId || undefined,
      state: 'QUESTION_READY',
    });

    const selectedTeam = selectedTeamId ? db.getTeam(selectedTeamId) : undefined;
    const teamMsg = selectedTeam ? ` (Đội chọn: ${selectedTeam.team_name} - ${selectedTeam.display_name})` : '';

    db.logEvent(
      'QUESTION_READY',
      `Quản trị viên đã mở CÂU ${targetQ.question_number}${teamMsg}: ${targetQ.content.substring(0, 50)}...`,
      selectedTeamId,
      targetQ.id
    );

    this.onStateChangeCallback?.('QUESTION_READY', {
      questionIndex: targetIndex,
      question: this.getSanitizedCurrentQuestion(),
      selectedTeamId: selectedTeamId || undefined,
      selectedTeam,
      completedQuestionNumbers: completedNums,
    });

    return { success: true, question: targetQ };
  }

  /**
   * Move to or prepare a specific question index
   */
  public prepareQuestion(questionIndex?: number): { success: boolean; question?: Question; error?: string } {
    this.clearTimers();
    const comp = db.getCompetition();
    const totalQuestions = db.getQuestions().length;

    let targetIndex = comp.current_question_index;
    if (questionIndex !== undefined) {
      if (questionIndex < 0 || questionIndex >= totalQuestions) {
        return { success: false, error: 'Chỉ số câu hỏi không hợp lệ' };
      }
      targetIndex = questionIndex;
    }

    const question = db.getQuestionByIndex(targetIndex);
    if (!question) {
      return { success: false, error: 'Không tìm thấy câu hỏi' };
    }

    this.lastSummaryResult = null;
    db.updateCompetition({
      current_question_index: targetIndex,
      current_session_id: undefined,
      state: 'QUESTION_READY',
    });

    db.logEvent(
      'QUESTION_READY',
      `Chuẩn bị câu hỏi số ${question.question_number}: ${question.content.substring(0, 50)}...`,
      undefined,
      question.id
    );

    this.onStateChangeCallback?.('QUESTION_READY', {
      questionIndex: targetIndex,
      question: this.getSanitizedCurrentQuestion(),
      completedQuestionNumbers: db.getCompletedQuestionNumbers(),
    });

    return { success: true, question };
  }

  /**
   * Start the question countdown and allow team submissions
   */
  public startQuestion(): { success: boolean; session?: QuestionSession; error?: string } {
    const comp = db.getCompetition();
    const question = this.getCurrentQuestion();
    if (!question) {
      return { success: false, error: 'Chưa chọn câu hỏi nào để bắt đầu' };
    }

    if (comp.state === 'RUNNING') {
      return { success: false, error: 'Câu hỏi đang diễn ra' };
    }

    this.clearTimers();

    const sessionId = `SESS-Q${question.question_number}-${Date.now()}`;
    const startedAt = Date.now();
    const timeLimitMs = question.time_limit * 1000;
    const endedAtExpected = startedAt + timeLimitMs;

    const newSession: QuestionSession = {
      id: sessionId,
      competition_id: comp.id,
      question_id: question.id,
      question_number: question.question_number,
      selected_team_id: comp.selected_team_id,
      status: 'RUNNING',
      started_at_ms: startedAt,
      ended_at_ms: endedAtExpected,
      time_limit_ms: timeLimitMs,
      correct_answer: question.correct_answer,
      created_at: new Date().toISOString(),
    };

    db.createSession(newSession);
    db.setQuizState('RUNNING');

    db.logEvent(
      'QUESTION_STARTED',
      `Bắt đầu câu hỏi số ${question.question_number} (${question.time_limit} giây - ${question.points} điểm)`,
      undefined,
      question.id,
      { sessionId, timeLimit: question.time_limit }
    );

    // Broadcast state change
    this.onStateChangeCallback?.('RUNNING', {
      session: newSession,
      question: this.getSanitizedCurrentQuestion(),
      startedAt,
      endedAt: endedAtExpected,
      timeLimitSec: question.time_limit,
    });

    // Start Realtime Countdown Ticks
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, endedAtExpected - now);
      const remainingSec = Number((remainingMs / 1000).toFixed(1));
      this.onTimeTickCallback?.(remainingSec, remainingMs);

      if (remainingMs <= 0) {
        this.handleTimeUp();
      }
    }, 100);

    // Exact timeout trigger
    this.activeTimer = setTimeout(() => {
      this.handleTimeUp();
    }, timeLimitMs);

    return { success: true, session: newSession };
  }

  /**
   * Stop / Lock question prematurely
   */
  public lockQuestion(): { success: boolean; error?: string } {
    this.clearTimers();
    const session = this.getCurrentSession();
    if (!session) {
      return { success: false, error: 'Không có phiên câu hỏi nào' };
    }

    db.updateSession(session.id, { status: 'ANSWER_LOCKED', ended_at_ms: Date.now() });
    db.setQuizState('ANSWER_LOCKED');

    db.logEvent(
      'QUESTION_LOCKED',
      `Quản trị viên đã bấm CHỐT / KHÓA câu hỏi số ${session.question_number}`,
      undefined,
      session.question_id
    );

    this.onStateChangeCallback?.('ANSWER_LOCKED', {
      session,
      answersCount: db.getAnswersForSession(session.id).length,
    });

    return { success: true };
  }

  /**
   * Automatic or manual Time Up
   */
  public handleTimeUp(): void {
    this.clearTimers();
    const comp = db.getCompetition();
    if (comp.state !== 'RUNNING') return;

    const session = this.getCurrentSession();
    if (!session) return;

    db.updateSession(session.id, { status: 'TIME_UP', ended_at_ms: Date.now() });
    db.setQuizState('TIME_UP');

    db.logEvent(
      'QUESTION_TIME_UP',
      `Hết thời gian trả lời câu hỏi số ${session.question_number}`,
      undefined,
      session.question_id
    );

    this.onStateChangeCallback?.('TIME_UP', {
      session,
      answersCount: db.getAnswersForSession(session.id).length,
    });
  }

  /**
   * Receive and validate team's answer submission (SINGLE SOURCE OF TRUTH)
   */
  public submitAnswer(
    teamId: string,
    sessionId: string,
    answer: AnswerOption,
    ipAddress?: string
  ): { success: boolean; error?: string; submission?: AnswerSubmission } {
    const comp = db.getCompetition();
    const now = Date.now();
    this.serverSequenceCounter += 1;
    const seq = this.serverSequenceCounter;

    // 1. Check competition state
    if (comp.state !== 'RUNNING') {
      const err = comp.state === 'TIME_UP' || comp.state === 'ANSWER_LOCKED'
        ? 'Thời gian làm bài đã kết thúc. Đáp án bị từ chối.'
        : 'Cuộc thi hiện chưa mở nhận đáp án.';
      db.logEvent('ANSWER_REJECTED', `Từ chối đáp án từ ${teamId}: ${err}`, teamId, undefined, { reason: comp.state });
      return { success: false, error: err };
    }

    // 2. Check session validity
    const currentSession = this.getCurrentSession();
    if (!currentSession || currentSession.id !== sessionId) {
      const err = 'Phiên câu hỏi không hợp lệ hoặc đã kết thúc.';
      db.logEvent('ANSWER_REJECTED', `Từ chối đáp án từ ${teamId}: Sai mã phiên`, teamId);
      return { success: false, error: err };
    }

    // 3. Check team validity & lock status
    const team = db.getTeam(teamId);
    if (!team) {
      return { success: false, error: 'Mã đội không tồn tại trong hệ thống.' };
    }
    if (team.status === 'LOCKED') {
      return { success: false, error: 'Đội của bạn đang bị khóa bởi Quản trị viên.' };
    }

    // 4. Check time limits (with strict server authority + 100ms network buffer)
    const maxAllowedTime = currentSession.started_at_ms + currentSession.time_limit_ms + 100;
    if (now > maxAllowedTime) {
      const err = 'Đáp án gửi đến máy chủ sau khi hết giờ. Bị từ chối.';
      db.logEvent('ANSWER_REJECTED', `Từ chối đáp án từ ${teamId}: Hết giờ (${now - currentSession.started_at_ms}ms)`, teamId);
      return { success: false, error: err };
    }

    // 5. Check valid option
    if (!['A', 'B', 'C', 'D'].includes(answer)) {
      return { success: false, error: 'Đáp án không hợp lệ. Chỉ chấp nhận A, B, C, D.' };
    }

    // 6. Check unique submission for this session
    const existingAnswers = db.getAnswersForSession(sessionId);
    const alreadyAnswered = existingAnswers.some((a) => a.team_id.toLowerCase() === teamId.toLowerCase());
    if (alreadyAnswered) {
      const err = 'Đội của bạn đã gửi đáp án cho câu hỏi này trước đó. Không thể sửa đáp án!';
      db.logEvent('ANSWER_REJECTED', `Từ chối đáp án gửi lần 2 từ ${teamId}`, teamId);
      return { success: false, error: err };
    }

    // 7. Calculate exact response time
    const responseTimeSec = Number(((now - currentSession.started_at_ms) / 1000).toFixed(3));
    const question = db.getQuestion(currentSession.question_id);
    const isCorrect = question ? question.correct_answer === answer : false;
    const score = isCorrect && question ? question.points : 0;

    const submission: AnswerSubmission = {
      id: `ANS-${sessionId}-${teamId}`,
      question_session_id: sessionId,
      question_id: currentSession.question_id,
      team_id: team.team_id,
      answer,
      received_at_ms: now,
      response_time_ms: responseTimeSec,
      is_correct: isCorrect,
      score,
      server_sequence: seq,
      created_at: new Date().toISOString(),
    };

    db.recordAnswer(submission);

    db.logEvent(
      'ANSWER_SUBMITTED',
      `${team.team_name} (${team.display_name}) đã gửi đáp án [${answer}] trong ${responseTimeSec}s (Sequence: ${seq})`,
      team.team_id,
      currentSession.question_id,
      { answer, responseTimeSec, sequence: seq, ip: ipAddress }
    );

    const totalSessionAnswers = db.getAnswersForSession(sessionId).length;
    this.onAnswerReceivedCallback?.(submission, totalSessionAnswers);

    return { success: true, submission };
  }

  /**
   * Reveal question results, fastest team, and update scoreboards
   */
  public revealResults(): { success: boolean; result?: QuestionSummaryResult; error?: string } {
    this.clearTimers();
    const session = this.getCurrentSession();
    if (!session) {
      return { success: false, error: 'Không có phiên câu hỏi hiện tại để công bố kết quả' };
    }

    const question = db.getQuestion(session.question_id);
    if (!question) {
      return { success: false, error: 'Không tìm thấy câu hỏi' };
    }

    const allTeams = db.getTeams();
    const sessionAnswers = db.getAnswersForSession(session.id);

    // 1. Sort correct submissions by speed to assign Olympic scoring rules:
    // - Đội đúng và nhanh nhất: 🥇 2.0 điểm
    // - Đội đúng thứ 2: 🥈 1.5 điểm
    // - Các đội đúng tiếp theo: 0 điểm
    // - Đội trả lời sai / không trả lời: 0 điểm (không bị trừ điểm)
    const correctSubmissions = sessionAnswers
      .filter((a) => a.is_correct)
      .sort((a, b) => {
        if (a.response_time_ms !== b.response_time_ms) {
          return a.response_time_ms - b.response_time_ms;
        }
        return a.server_sequence - b.server_sequence;
      });

    correctSubmissions.forEach((sub, idx) => {
      if (idx === 0) {
        sub.score = 2.0;
      } else if (idx === 1) {
        sub.score = 1.5;
      } else {
        sub.score = 0;
      }
    });

    sessionAnswers
      .filter((a) => !a.is_correct)
      .forEach((sub) => {
        sub.score = 0;
      });

    db.save();

    // Build question results item
    const results: QuestionResultItem[] = allTeams.map((team) => {
      const sub = sessionAnswers.find((a) => a.team_id.toLowerCase() === team.team_id.toLowerCase());
      return {
        team_id: team.team_id,
        team_name: team.team_name,
        display_name: team.display_name,
        answer: sub ? sub.answer : null,
        response_time_sec: sub ? sub.response_time_ms : null,
        is_correct: sub ? sub.is_correct : false,
        score: sub ? sub.score : 0,
        server_sequence: sub ? sub.server_sequence : 999999,
        is_fastest: false,
      };
    });

    // Mark fastest team and top speed rankings
    const correctItems = results
      .filter((r) => r.is_correct && r.response_time_sec !== null)
      .sort((a, b) => {
        if (a.response_time_sec! !== b.response_time_sec!) {
          return a.response_time_sec! - b.response_time_sec!;
        }
        return a.server_sequence - b.server_sequence;
      });

    let fastestTeamSummary: QuestionSummaryResult['fastest_team'] = undefined;
    if (correctItems.length > 0) {
      const fastest = correctItems[0];
      fastest.is_fastest = true;
      fastestTeamSummary = {
        team_id: fastest.team_id,
        team_name: fastest.team_name,
        display_name: fastest.display_name,
        response_time_sec: fastest.response_time_sec!,
        answer: fastest.answer!,
      };
    }

    // Sort full results for clean table display: Correct first by speed, then Incorrect by speed, then unanswered
    results.sort((a, b) => {
      if (a.is_correct && !b.is_correct) return -1;
      if (!a.is_correct && b.is_correct) return 1;
      if (a.response_time_sec !== null && b.response_time_sec !== null) {
        return a.response_time_sec - b.response_time_sec;
      }
      if (a.response_time_sec !== null && b.response_time_sec === null) return -1;
      if (a.response_time_sec === null && b.response_time_sec !== null) return 1;
      return 0;
    });

    const correctCount = results.filter((r) => r.is_correct).length;
    const wrongCount = results.filter((r) => !r.is_correct && r.answer !== null).length;
    const unansweredCount = results.filter((r) => r.answer === null).length;

    const summaryResult: QuestionSummaryResult = {
      session_id: session.id,
      question_id: question.id,
      question_number: question.question_number,
      content: question.content,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      total_submissions: sessionAnswers.length,
      correct_count: correctCount,
      wrong_count: wrongCount,
      unanswered_count: unansweredCount,
      fastest_team: fastestTeamSummary,
      results,
    };

    this.lastSummaryResult = summaryResult;

    db.updateSession(session.id, { status: 'RESULT' });
    db.setQuizState('RESULT');

    const fastestText = fastestTeamSummary
      ? ` | Đội nhanh nhất: ${fastestTeamSummary.team_name} (${fastestTeamSummary.response_time_sec}s)`
      : '';
    db.logEvent(
      'QUESTION_RESULT',
      `Công bố kết quả Câu ${question.question_number}: Đáp án đúng [${question.correct_answer}] | Đúng: ${correctCount}/${allTeams.length}${fastestText}`,
      undefined,
      question.id,
      { correct_answer: question.correct_answer, correctCount, fastest: fastestTeamSummary }
    );

    const leaderboard = db.calculateLeaderboard();
    const completedQuestionNumbers = db.getCompletedQuestionNumbers();
    const completedQuestionIds = db.getCompletedQuestionIds();

    this.onStateChangeCallback?.('RESULT', {
      result: summaryResult,
      leaderboard,
      completedQuestionNumbers,
      completedQuestionIds,
    });

    return { success: true, result: summaryResult };
  }

  /**
   * Advance to next question or conclude
   */
  public nextQuestion(): { success: boolean; finished?: boolean; error?: string } {
    const comp = db.getCompetition();
    const questions = db.getQuestions();
    const nextIdx = comp.current_question_index + 1;

    if (nextIdx >= questions.length) {
      // Finished all questions
      db.setQuizState('FINISHED');
      db.logEvent('COMPETITION_FINISHED', 'Cuộc thi đã hoàn thành tất cả các câu hỏi!');
      const leaderboard = db.calculateLeaderboard();
      this.onStateChangeCallback?.('FINISHED', { leaderboard });
      return { success: true, finished: true };
    }

    return this.prepareQuestion(nextIdx);
  }

  public prevQuestion(): { success: boolean; error?: string } {
    const comp = db.getCompetition();
    const prevIdx = Math.max(0, comp.current_question_index - 1);
    return this.prepareQuestion(prevIdx);
  }

  public finishCompetition(): { success: boolean } {
    this.clearTimers();
    db.setQuizState('FINISHED');
    db.logEvent('COMPETITION_FINISHED', 'Quản trị viên đã kết thúc cuộc thi và chốt bảng xếp hạng chung cuộc.');
    const leaderboard = db.calculateLeaderboard();
    this.onStateChangeCallback?.('FINISHED', { leaderboard });
    return { success: true };
  }

  public showLeaderboard(): { success: boolean; leaderboard: TeamScoreStats[] } {
    this.clearTimers();
    db.setQuizState('LEADERBOARD');
    db.logEvent('SCORE_UPDATED', 'Quản trị viên đã kích hoạt TRÌNH CHIẾU BẢNG XẾP HẠNG TỔNG ĐIỂM');
    const leaderboard = db.calculateLeaderboard();
    this.onStateChangeCallback?.('LEADERBOARD', { leaderboard });
    return { success: true, leaderboard };
  }

  public showQuestionResult(): { success: boolean; result?: QuestionSummaryResult; error?: string } {
    this.clearTimers();
    let summary = this.lastSummaryResult;

    if (!summary) {
      const session = this.getCurrentSession();
      if (session) {
        const rev = this.revealResults();
        summary = rev.result || null;
      }
    }

    if (!summary) {
      const sessions = db.getSessions();
      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        const q = db.getQuestion(lastSession.question_id);
        if (q) {
          const allTeams = db.getTeams();
          const sessionAnswers = db.getAnswersForSession(lastSession.id);
          const correctSubmissions = sessionAnswers
            .filter((a) => a.is_correct)
            .sort((a, b) => {
              if (a.response_time_ms !== b.response_time_ms) {
                return a.response_time_ms - b.response_time_ms;
              }
              return a.server_sequence - b.server_sequence;
            });

          const results: QuestionResultItem[] = allTeams.map((team) => {
            const sub = sessionAnswers.find((a) => a.team_id.toLowerCase() === team.team_id.toLowerCase());
            return {
              team_id: team.team_id,
              team_name: team.team_name,
              display_name: team.display_name,
              answer: sub ? sub.answer : null,
              response_time_sec: sub ? sub.response_time_ms : null,
              is_correct: sub ? sub.is_correct : false,
              score: sub ? sub.score : 0,
              server_sequence: sub ? sub.server_sequence : 999999,
              is_fastest: false,
            };
          });

          if (correctSubmissions.length > 0) {
            const fastestSub = correctSubmissions[0];
            const item = results.find((r) => r.team_id === fastestSub.team_id);
            if (item) item.is_fastest = true;
          }

          results.sort((a, b) => {
            if (a.is_correct && !b.is_correct) return -1;
            if (!a.is_correct && b.is_correct) return 1;
            if (a.response_time_sec !== null && b.response_time_sec !== null) {
              return a.response_time_sec - b.response_time_sec;
            }
            if (a.response_time_sec !== null && b.response_time_sec === null) return -1;
            if (a.response_time_sec === null && b.response_time_sec !== null) return 1;
            return 0;
          });

          summary = {
            session_id: lastSession.id,
            question_id: q.id,
            question_number: q.question_number,
            content: q.content,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            total_submissions: sessionAnswers.length,
            correct_count: results.filter((r) => r.is_correct).length,
            wrong_count: results.filter((r) => !r.is_correct && r.answer !== null).length,
            unanswered_count: results.filter((r) => r.answer === null).length,
            fastest_team:
              correctSubmissions.length > 0
                ? {
                    team_id: correctSubmissions[0].team_id,
                    team_name: db.getTeam(correctSubmissions[0].team_id)?.team_name || correctSubmissions[0].team_id,
                    display_name: db.getTeam(correctSubmissions[0].team_id)?.display_name || correctSubmissions[0].team_id,
                    response_time_sec: correctSubmissions[0].response_time_ms,
                    answer: correctSubmissions[0].answer,
                  }
                : undefined,
            results,
          };
          this.lastSummaryResult = summary;
        }
      }
    }

    if (!summary) {
      return { success: false, error: 'Chưa có kết quả câu hỏi để trình chiếu' };
    }

    db.setQuizState('SHOW_QUESTION_RESULT');
    db.logEvent('SCORE_UPDATED', `Quản trị viên đã kích hoạt TRÌNH CHIẾU KẾT QUẢ CÂU HỎI ${summary.question_number}`);

    const fullQ = db.getQuestion(summary.question_id);
    this.onStateChangeCallback?.('SHOW_QUESTION_RESULT', {
      result: summary,
      question: fullQ,
    });

    return { success: true, result: summary };
  }

  public resetCompetition(): { success: boolean } {
    this.clearTimers();
    db.resetToDemo();
    this.onStateChangeCallback?.('IDLE', { message: 'Đã thiết lập lại toàn bộ cuộc thi' });
    return { success: true };
  }

  public recoverQuestion(action: 'CONTINUE' | 'CANCEL'): { success: boolean } {
    this.clearTimers();
    if (action === 'CONTINUE') {
      const q = this.getCurrentQuestion();
      if (q) {
        return this.prepareQuestion(db.getCompetition().current_question_index);
      }
    }
    db.setQuizState('IDLE');
    db.logEvent('COMPETITION_RESET', 'Quản trị viên đã hủy phiên câu hỏi dở dang sau khi phục hồi hệ thống.');
    this.onStateChangeCallback?.('IDLE');
    return { success: true };
  }

  /**
   * Simulation mode: Simulates connected or all teams answering concurrently
   */
  public simulateTeamAnswers(count: number = 10): { simulated: number; errors: string[] } {
    const comp = db.getCompetition();
    if (comp.state !== 'RUNNING') {
      return { simulated: 0, errors: ['Cuộc thi không trong trạng thái RUNNING. Hãy bấm Bắt đầu trước.'] };
    }

    const session = this.getCurrentSession();
    if (!session) {
      return { simulated: 0, errors: ['Không tìm thấy phiên câu hỏi.'] };
    }

    const question = db.getQuestion(session.question_id);
    if (!question) {
      return { simulated: 0, errors: ['Không tìm thấy câu hỏi.'] };
    }

    const teams = db.getTeams().slice(0, count);
    const errors: string[] = [];
    let simulatedCount = 0;

    teams.forEach((team, idx) => {
      // Random delay between 1.2s and 12.0s
      const delayMs = Math.floor(1200 + Math.random() * (question.time_limit * 1000 - 2500));
      // 75% chance to pick correct answer, 25% random wrong
      const options: AnswerOption[] = ['A', 'B', 'C', 'D'];
      const isCorrect = Math.random() < 0.75;
      const pickedAnswer: AnswerOption = isCorrect
        ? question.correct_answer
        : options[Math.floor(Math.random() * options.length)];

      setTimeout(() => {
        if (db.getCompetition().state === 'RUNNING') {
          const res = this.submitAnswer(team.team_id, session.id, pickedAnswer, '127.0.0.1 (Simulator)');
          if (res.success) {
            simulatedCount++;
          }
        }
      }, delayMs);
    });

    db.logEvent(
      'SIMULATION_TRIGGERED',
      `Khởi chạy mô phỏng ${teams.length} đội trả lời tự động cho câu hỏi ${question.question_number}`
    );

    return { simulated: teams.length, errors };
  }

  private clearTimers(): void {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Generates full snapshot for a reconnecting client
   */
  public getClientSnapshot(teamId?: string) {
    const comp = db.getCompetition();
    const currentQ = this.getSanitizedCurrentQuestion();
    const session = this.getCurrentSession();
    const leaderboard = db.calculateLeaderboard();

    let teamAnswered = false;
    let teamAnswerOption: AnswerOption | undefined = undefined;
    let teamResponseTime: number | undefined = undefined;

    if (teamId && session) {
      const existing = db.getAnswersForSession(session.id).find(
        (a) => a.team_id.toLowerCase() === teamId.toLowerCase()
      );
      if (existing) {
        teamAnswered = true;
        teamAnswerOption = existing.answer;
        teamResponseTime = existing.response_time_ms;
      }
    }

    let remainingMs = 0;
    if (comp.state === 'RUNNING' && session) {
      remainingMs = Math.max(0, session.ended_at_ms - Date.now());
    }

    return {
      competition: comp,
      currentQuestion: currentQ,
      session,
      remainingMs,
      teamAnswered,
      teamAnswerOption,
      teamResponseTime,
      leaderboard,
      teams: db.getTeams(),
      questions: db.getQuestions(),
      completedQuestionNumbers: db.getCompletedQuestionNumbers(),
      completedQuestionIds: db.getCompletedQuestionIds(),
      result: this.lastSummaryResult || undefined,
    };
  }

  public getLastSummaryResult(): QuestionSummaryResult | null {
    return this.lastSummaryResult;
  }

  public getCurrentQuestionSummary(): QuestionSummaryResult | null {
    return this.lastSummaryResult;
  }

  public handleRecovery(continueIfRunning: boolean = true) {
    const comp = db.getCompetition();
    return { success: true, message: 'Khôi phục trạng thái hoàn tất', state: comp.state };
  }

  public simulateAnswersForAllTeams(count?: number) {
    return { success: true, message: 'Đã hoàn thành mô phỏng' };
  }
}

export const quizEngine = new QuizEngine();

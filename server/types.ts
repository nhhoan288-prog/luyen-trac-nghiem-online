export type QuizState =
  | 'IDLE'
  | 'QUESTION_BOARD'
  | 'QUESTION_READY'
  | 'RUNNING'
  | 'TIME_UP'
  | 'ANSWER_LOCKED'
  | 'RESULT'
  | 'SHOW_QUESTION_RESULT'
  | 'LEADERBOARD'
  | 'FINISHED'
  | 'RECOVERY_REQUIRED';

export type AnswerOption = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type ExamStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'TIMEOUT';

export interface Team {
  team_id: string; // e.g. "TEAM01"
  team_number: number; // e.g. 1
  team_name: string; // e.g. "Đội 01"
  display_name: string; // e.g. "Đội 01 - Rồng Vàng"
  status: 'ACTIVE' | 'LOCKED';
  connected: boolean;
  active_client_id?: string;
  ip_address?: string;
  avatar_color?: string;
  created_at: string;
}

export interface Question {
  id: string;
  question_number: number;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  option_f?: string;
  options_count?: number;
  difficulty?: number;
  table_html?: string;
  source_file_path?: string;
  correct_answer: AnswerOption;
  time_limit?: number; // in seconds
  points?: number; // 0.6 for standard 50 questions
  image_url?: string;
  question_type: 'MULTIPLE_CHOICE';
  explanation?: string;
  category?: string;
  created_at: string;
}

export interface SanitizedQuestion {
  id: string;
  question_number: number;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  option_f?: string;
  options_count?: number;
  difficulty?: number;
  table_html?: string;
  time_limit?: number;
  points?: number;
  image_url?: string;
  question_type: 'MULTIPLE_CHOICE';
  explanation?: string;
  category?: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: number;
  total_questions: number;
  icon?: string;
  color_gradient?: string;
  progress_percentage?: number;
  source_file_path?: string;
  questions?: Question[];
  created_at: string;
}

export interface PlayerProgress {
  streak_days: number;
  total_answered: number;
  correct_count: number;
  wrong_question_ids: string[];
  accuracy_percentage: number;
  best_score: number;
  auto_next_delay_sec: number; // 1 | 1.5 | 2 | 3
  sets_progress?: Record<string, number>;
}

// Option item in a candidate's randomized exam session
export interface SessionOptionItem {
  optionId: string; // e.g. "opt_a", "opt_b", "opt_c", "opt_d"
  displayLabel: AnswerOption; // Shuffled label displayed to candidate
  content: string; // Option text
}

// Question item in a candidate's randomized exam session (Sanitized: NO correct answer)
export interface SessionQuestionItem {
  questionId: string;
  displayNumber: number; // 1 to 50
  originalNumber: number;
  content: string;
  options: SessionOptionItem[]; // Shuffled options
  image_url?: string;
  table_html?: string;
  category?: string;
}

// Answer submitted by candidate for a specific question
export interface CandidateAnswer {
  questionId: string;
  selectedOptionId: string;
  answeredAtMs: number;
  displayNumber: number;
}

// Individual exam session for each candidate / team
export interface QuizSession {
  id: string; // e.g. "QS-TEAM01-..."
  playerId: string; // team_id
  playerName: string; // team_name
  displayName: string;
  avatarColor?: string;
  startTimeMs: number; // Server timestamp when started
  durationLimitMs: number; // Default 30 * 60 * 1000 = 1,800,000 ms
  submitTimeMs: number | null;
  durationSec: number | null;
  status: ExamStatus;
  answers: Record<string, CandidateAnswer>; // questionId -> answer
  correctAnswersCount: number;
  score: number; // correctAnswersCount * 0.6 (formatted to 1 decimal place)
  sessionSeed: string;
  questionsOrder: SessionQuestionItem[]; // 50 shuffled questions with shuffled options
  createdAt: string;
}

// Sanitized session sent to client (does NOT contain answers key mapping of other players)
export interface SanitizedQuizSession {
  id: string;
  playerId: string;
  playerName: string;
  displayName: string;
  avatarColor?: string;
  startTimeMs: number;
  durationLimitMs: number;
  serverTimeMs: number;
  remainingTimeSec: number;
  submitTimeMs: number | null;
  durationSec: number | null;
  status: ExamStatus;
  answers: Record<string, { questionId: string; selectedOptionId: string; answeredAtMs: number }>;
  questions: SessionQuestionItem[];
  totalQuestions: number;
  correctAnswersCount?: number; // Only returned if SUBMITTED or TIMEOUT
  score?: number; // Only returned if SUBMITTED or TIMEOUT
}

export interface Competition {
  id: string;
  name: string;
  description: string;
  organizer: string;
  event_date: string;
  logo_url?: string;
  is_active: boolean;
  current_question_index: number;
  current_session_id?: string;
  selected_team_id?: string;
  state: QuizState;
  completed_question_numbers?: number[];
  total_questions?: number;
  duration_minutes?: number;
  points_per_question?: number;
}

export interface QuestionSession {
  id: string;
  competition_id: string;
  question_id: string;
  question_number: number;
  selected_team_id?: string;
  status: QuizState;
  started_at_ms: number;
  ended_at_ms: number;
  time_limit_ms: number;
  correct_answer: AnswerOption;
  created_at: string;
}

export interface AnswerSubmission {
  id: string;
  question_session_id: string;
  question_id: string;
  team_id: string;
  answer: AnswerOption;
  received_at_ms: number;
  response_time_ms: number;
  is_correct: boolean;
  score: number;
  server_sequence: number;
  created_at: string;
}

export interface EventLog {
  id: string;
  timestamp_iso: string;
  timestamp_ms: number;
  event_type:
    | 'SYSTEM_BOOT'
    | 'EXAM_STARTED'
    | 'EXAM_ANSWER_SAVED'
    | 'EXAM_SUBMITTED'
    | 'EXAM_TIMEOUT'
    | 'EXAM_RESET'
    | 'QUESTION_READY'
    | 'QUESTION_STARTED'
    | 'ANSWER_SUBMITTED'
    | 'ANSWER_REJECTED'
    | 'QUESTION_TIME_UP'
    | 'QUESTION_LOCKED'
    | 'QUESTION_RESULT'
    | 'SCORE_UPDATED'
    | 'TEAM_CONNECTED'
    | 'TEAM_DISCONNECTED'
    | 'TEAM_OVERRIDE_KICK'
    | 'TEAM_UPDATED'
    | 'TEAM_RENAMED'
    | 'COMPETITION_RESET'
    | 'COMPETITION_FINISHED'
    | 'MANUAL_SCORE_ADJUST'
    | 'SIMULATION_TRIGGERED';
  team_id?: string;
  question_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TeamScoreStats {
  team_id: string;
  team_number: number;
  team_name: string;
  display_name: string;
  total_score: number; // e.g. 27.0
  correct_count: number; // e.g. 45
  wrong_count: number;
  unanswered_count: number;
  answered_count: number;
  total_questions: number; // 50
  average_response_time_sec: number;
  total_response_time_sec: number; // durationSec
  status: ExamStatus;
  submit_time_ms: number | null;
  start_time_ms: number | null;
  rank: number;
  avatar_color?: string;
}

export interface QuestionResultItem {
  team_id: string;
  team_name: string;
  display_name: string;
  answer: AnswerOption | null;
  response_time_sec: number | null;
  is_correct: boolean;
  score: number;
  server_sequence: number;
  is_fastest: boolean;
}

export interface QuestionSummaryResult {
  session_id?: string;
  question_id: string;
  question_number: number;
  content: string;
  correct_answer: AnswerOption;
  explanation?: string;
  category?: string;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  total_teams?: number;
  total_submissions?: number;
  total_submitted?: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  distribution?: {
    A: number;
    B: number;
    C: number;
    D: number;
    NO_ANSWER: number;
  };
  fastest_team?: {
    team_id: string;
    team_name: string;
    display_name: string;
    response_time_sec: number;
    answer: AnswerOption;
  };
  fastest_teams?: QuestionResultItem[];
  results?: QuestionResultItem[];
  all_results?: QuestionResultItem[];
}

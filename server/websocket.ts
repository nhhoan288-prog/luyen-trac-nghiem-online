import { WebSocket, WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { db } from './database';
import { quizEngine } from './quizEngine';
import { AnswerOption, Team } from './types';
import { isValidAdminToken } from './api';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  role: 'ADMIN' | 'TEAM' | 'DISPLAY';
  team_id?: string;
  ip_address: string;
  connected_at: number;
}

export class QuizWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();

  public init(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = `CLI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const ip =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const clientInfo: ConnectedClient = {
        id: clientId,
        ws,
        role: 'DISPLAY', // default until registered
        ip_address: ip,
        connected_at: Date.now(),
      };

      this.clients.set(clientId, clientInfo);

      ws.on('message', (messageRaw: string) => {
        try {
          const message = JSON.parse(messageRaw.toString());
          this.handleClientMessage(clientInfo, message);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      });

      ws.on('close', () => {
        this.handleClientDisconnect(clientInfo);
      });

      ws.on('error', (err) => {
        console.error(`WS client error [${clientId}]:`, err);
      });

      // Send initial welcome
      this.sendToClient(clientInfo, {
        type: 'CONNECTED',
        payload: {
          client_id: clientId,
          server_time: Date.now(),
        },
      });
    });

    // Wire up engine events to broadcast
    quizEngine.setEventCallbacks({
      onStateChange: (state, payload) => {
        this.handleEngineStateChange(state, payload);
      },
      onTimeTick: (timeLeftSec, timeLeftMs) => {
        this.broadcast({
          type: 'TIME_TICK',
          payload: { timeLeftSec, timeLeftMs, serverTime: Date.now() },
        });
      },
      onAnswerReceived: (answer, totalAnswers) => {
        this.broadcastToRoles(['ADMIN', 'DISPLAY'], {
          type: 'SUBMISSION_UPDATE',
          payload: {
            team_id: answer.team_id,
            team_name: db.getTeam(answer.team_id)?.team_name || answer.team_id,
            display_name: db.getTeam(answer.team_id)?.display_name || answer.team_id,
            response_time_sec: answer.response_time_ms,
            total_submissions: totalAnswers,
            total_teams: db.getTeams().length,
          },
        });
      },
    });

    // Periodic Heartbeat
    setInterval(() => {
      this.broadcast({
        type: 'HEARTBEAT',
        payload: { server_time: Date.now(), connected_clients: this.clients.size },
      });
    }, 15000);

    // Automatic Exam Session Timeout Checker (1s tick)
    setInterval(() => {
      const hasExpired = db.checkAndAutoSubmitExpiredSessions();
      if (hasExpired) {
        this.broadcastExamLeaderboard();
      }
    }, 1000);
  }

  private handleClientMessage(client: ConnectedClient, message: any) {
    const { type, payload } = message;

    switch (type) {
      case 'JOIN': {
        const { role, team_id, force_takeover, admin_token } = payload || {};

        if (role === 'ADMIN') {
          if (isValidAdminToken(admin_token)) {
            client.role = 'ADMIN';
          } else {
            client.role = 'DISPLAY';
          }
        } else if (role === 'TEAM') {
          client.role = 'TEAM';
        } else {
          client.role = 'DISPLAY';
        }

        if (client.role === 'TEAM' && team_id) {
          const team = db.getTeam(team_id);
          if (!team) {
            this.sendToClient(client, {
              type: 'JOIN_REJECTED',
              payload: { message: `Mã đội ${team_id} không tồn tại trên hệ thống.` },
            });
            return;
          }

          const existingClient = Array.from(this.clients.values()).find(
            (c) =>
              c.role === 'TEAM' &&
              c.team_id?.toLowerCase() === team_id.toLowerCase() &&
              c.id !== client.id
          );

          if (existingClient && !force_takeover) {
            this.sendToClient(client, {
              type: 'JOIN_REJECTED',
              payload: {
                code: 'DEVICE_ALREADY_LOGGED_IN',
                message: `Đội [${team.team_name}] đang được sử dụng trên thiết bị khác (${existingClient.ip_address}). Hãy liên hệ Quản trị viên để ngắt kết nối hoặc xác nhận chiếm quyền.`,
                team_name: team.team_name,
              },
            });
            return;
          }

          if (existingClient) {
            this.sendToClient(existingClient, {
              type: 'KICKED',
              payload: { message: 'Đội của bạn đã được đăng nhập từ một thiết bị mới.' },
            });
            existingClient.ws.close();
            this.clients.delete(existingClient.id);
            db.logEvent(
              'TEAM_OVERRIDE_KICK',
              `Thiết bị mới (${client.ip_address}) đã chiếm quyền kết nối của đội ${team.team_name}`,
              team.team_id
            );
          }

          client.team_id = team.team_id;
          db.setTeamConnection(team.team_id, true, client.id, client.ip_address);
          db.logEvent('TEAM_CONNECTED', `Đội ${team.team_name} kết nối từ IP: ${client.ip_address}`, team.team_id);

          this.broadcastToRoles(['ADMIN'], {
            type: 'TEAM_STATUS_CHANGED',
            payload: { team: db.getTeam(team.team_id), total_connected: this.getConnectedTeamsCount() },
          });
        }

        // Send full snapshot on join
        const snapshot = quizEngine.getClientSnapshot(client.team_id);
        const fullQ = quizEngine.getCurrentQuestion();
        const examLeaderboard = db.calculateExamLeaderboard();

        this.sendToClient(client, {
          type: 'JOIN_ACCEPTED',
          payload: {
            role: client.role,
            team_id: client.team_id,
            snapshot: {
              ...snapshot,
              currentQuestion: client.role === 'ADMIN' ? fullQ : snapshot.currentQuestion,
            },
            examLeaderboard,
          },
        });
        break;
      }

      case 'SUBMIT_ANSWER': {
        if (client.role !== 'TEAM' || !client.team_id) {
          this.sendToClient(client, {
            type: 'ANSWER_REJECTED',
            payload: { error: 'Chỉ thiết bị của Đội thi mới có quyền gửi đáp án.' },
          });
          return;
        }

        const { session_id, answer } = payload as { session_id: string; answer: AnswerOption };
        const result = quizEngine.submitAnswer(client.team_id, session_id, answer, client.ip_address);

        if (result.success && result.submission) {
          this.sendToClient(client, {
            type: 'ANSWER_ACCEPTED',
            payload: {
              answer: result.submission.answer,
              response_time_sec: result.submission.response_time_ms,
              sequence: result.submission.server_sequence,
              message: 'ĐÁP ÁN ĐÃ ĐƯỢC GHI NHẬN THÀNH CÔNG VÀO HỆ THỐNG',
            },
          });
        } else {
          this.sendToClient(client, {
            type: 'ANSWER_REJECTED',
            payload: { error: result.error || 'Gửi đáp án thất bại' },
          });
        }
        break;
      }

      case 'RENAME_TEAM':
      case 'TEAM_RENAME': {
        if (client.role !== 'TEAM' || !client.team_id) {
          this.sendToClient(client, {
            type: 'RENAME_REJECTED',
            payload: { error: 'Chỉ thiết bị của Đội thi mới có quyền đổi tên đội của mình.' },
          });
          return;
        }

        const { newName, display_name, avatar_color } = (payload || {}) as {
          newName?: string;
          display_name?: string;
          avatar_color?: string;
        };
        const nameToSet = newName || display_name;

        try {
          const updated = db.renameTeam(client.team_id, nameToSet || '', avatar_color);
          db.logEvent('TEAM_RENAMED', `Đội ${client.team_id} đã đổi tên thành: "${updated.display_name}"`, client.team_id);
          this.broadcastTeamUpdate(updated);
          this.sendToClient(client, {
            type: 'RENAME_ACCEPTED',
            payload: { team: updated, message: 'Đổi tên đội thành công' },
          });
        } catch (err: any) {
          this.sendToClient(client, {
            type: 'RENAME_REJECTED',
            payload: { error: err.message || 'Không thể đổi tên đội' },
          });
        }
        break;
      }

      case 'PING': {
        this.sendToClient(client, {
          type: 'PONG',
          payload: { timestamp: Date.now() },
        });
        break;
      }

      default:
        break;
    }
  }

  private handleClientDisconnect(client: ConnectedClient) {
    this.clients.delete(client.id);
    if (client.role === 'TEAM' && client.team_id) {
      db.setTeamConnection(client.team_id, false, client.id);
      db.logEvent('TEAM_DISCONNECTED', `Đội ${client.team_id} đã ngắt kết nối`, client.team_id);
      this.broadcastToRoles(['ADMIN'], {
        type: 'TEAM_STATUS_CHANGED',
        payload: { team: db.getTeam(client.team_id), total_connected: this.getConnectedTeamsCount() },
      });
    }
  }

  private handleEngineStateChange(state: string, payload?: any) {
    const fullQ = quizEngine.getCurrentQuestion();
    const sanitizedQ = quizEngine.getSanitizedCurrentQuestion();
    const completedQuestionNumbers = db.getCompletedQuestionNumbers();
    const completedQuestionIds = db.getCompletedQuestionIds();
    const enrichedPayload = {
      completedQuestionNumbers,
      completedQuestionIds,
      ...payload,
    };

    switch (state) {
      case 'QUESTION_BOARD':
        this.broadcast({
          type: 'QUESTION_BOARD',
          payload: enrichedPayload,
        });
        break;

      case 'QUESTION_READY':
        this.broadcastToRoles(['ADMIN'], {
          type: 'QUESTION_READY',
          payload: { ...enrichedPayload, question: fullQ },
        });
        this.broadcastToRoles(['TEAM', 'DISPLAY'], {
          type: 'QUESTION_READY',
          payload: { ...enrichedPayload, question: sanitizedQ },
        });
        break;

      case 'RUNNING':
        this.broadcastToRoles(['ADMIN'], {
          type: 'QUESTION_STARTED',
          payload: { ...enrichedPayload, question: fullQ },
        });
        this.broadcastToRoles(['TEAM', 'DISPLAY'], {
          type: 'QUESTION_STARTED',
          payload: { ...enrichedPayload, question: sanitizedQ },
        });
        break;

      case 'TIME_UP':
        this.broadcast({
          type: 'QUESTION_TIME_UP',
          payload: enrichedPayload,
        });
        break;

      case 'ANSWER_LOCKED':
        this.broadcast({
          type: 'QUESTION_LOCKED',
          payload: enrichedPayload,
        });
        break;

      case 'RESULT':
        this.broadcast({
          type: 'QUESTION_RESULT',
          payload: enrichedPayload,
        });
        break;

      case 'SHOW_QUESTION_RESULT':
        this.broadcast({
          type: 'SHOW_QUESTION_RESULT',
          payload: enrichedPayload,
        });
        break;

      case 'LEADERBOARD':
        this.broadcast({
          type: 'SHOW_LEADERBOARD',
          payload: {
            ...enrichedPayload,
            leaderboard: payload?.leaderboard || db.calculateExamLeaderboard(),
          },
        });
        break;

      case 'FINISHED':
        this.broadcast({
          type: 'COMPETITION_FINISHED',
          payload: enrichedPayload,
        });
        break;

      case 'IDLE':
        this.broadcast({
          type: 'COMPETITION_IDLE',
          payload: enrichedPayload,
        });
        break;

      default:
        this.broadcast({
          type: 'STATE_CHANGED',
          payload: { state, ...enrichedPayload },
        });
        break;
    }
  }

  // --- Realtime Exam Broadcast Methods ---
  public broadcastTeamUpdate(team: Team) {
    this.broadcast({
      type: 'TEAM_NAME_UPDATED',
      teamId: team.team_id,
      newName: team.display_name,
      payload: {
        teamId: team.team_id,
        newName: team.display_name,
        team,
      },
    });
    this.broadcast({
      type: 'TEAM_UPDATED',
      payload: { team, total_connected: this.getConnectedTeamsCount() },
    });
    this.broadcastExamLeaderboard();
  }

  public broadcastExamLeaderboard() {
    const leaderboard = db.calculateExamLeaderboard();
    const officialRankings = leaderboard.filter((s) => s.rank > 0);
    const inProgressTeams = leaderboard.filter((s) => s.status === 'IN_PROGRESS');
    const notStartedTeams = leaderboard.filter((s) => s.status === 'NOT_STARTED');

    this.broadcast({
      type: 'EXAM_LEADERBOARD_UPDATE',
      payload: {
        leaderboard,
        officialRankings,
        inProgressTeams,
        notStartedTeams,
        serverTime: Date.now(),
      },
    });
  }

  public broadcastExamProgress(playerId: string, answeredCount: number) {
    this.broadcastToRoles(['ADMIN', 'DISPLAY'], {
      type: 'EXAM_PROGRESS_UPDATE',
      payload: {
        playerId,
        answeredCount,
        serverTime: Date.now(),
      },
    });
  }

  public kickTeam(teamId: string, reason?: string): boolean {
    const clientsToKick = Array.from(this.clients.values()).filter(
      (c) => c.role === 'TEAM' && c.team_id?.toLowerCase() === teamId.toLowerCase()
    );

    clientsToKick.forEach((client) => {
      this.sendToClient(client, {
        type: 'KICKED',
        payload: { message: reason || 'Quản trị viên đã ngắt kết nối thiết bị này.' },
      });
      client.ws.close();
      this.clients.delete(client.id);
    });

    db.setTeamConnection(teamId, false);
    db.logEvent('TEAM_OVERRIDE_KICK', `Quản trị viên đã ngắt kết nối thiết bị của đội ${teamId}`, teamId);
    this.broadcastToRoles(['ADMIN'], {
      type: 'TEAM_STATUS_CHANGED',
      payload: { team: db.getTeam(teamId), total_connected: this.getConnectedTeamsCount() },
    });
    return true;
  }

  public getConnectedTeamsCount(): number {
    return Array.from(this.clients.values()).filter((c) => c.role === 'TEAM').length;
  }

  public broadcast(message: any) {
    const raw = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    });
  }

  public broadcastToRoles(roles: Array<'ADMIN' | 'TEAM' | 'DISPLAY'>, message: any) {
    const raw = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (roles.includes(client.role) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    });
  }

  public sendToClient(client: ConnectedClient, message: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

export const quizWsServer = new QuizWebSocketServer();

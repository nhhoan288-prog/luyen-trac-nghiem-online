import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import apiRouter from './server/api';
import { quizWsServer } from './server/websocket';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';

  // Middlewares
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes FIRST
  app.use('/api', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Quiz Realtime LAN Server',
      timestamp: Date.now(),
    });
  });

  const server = http.createServer(app);

  // Initialize WebSocket server attached to HTTP server
  quizWsServer.init(server);

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`[LAN QUIZ SERVER] Server running on http://${HOST}:${PORT}`);
    console.log(`[LAN QUIZ SERVER] WebSocket endpoint ready at ws://${HOST}:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('[LAN QUIZ SERVER] Failed to start server:', err);
  process.exit(1);
});

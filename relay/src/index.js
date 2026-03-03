/**
 * OpenClaw Relay - 主入口
 * 本地监听 127.0.0.1:<PORT>，提供 HTTP REST + WebSocket (M2)
 */
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { router, sessions } from './routes.js';
import { verifyWsToken } from './auth.js';

const PORT          = parseInt(process.env.PORT ?? '9223', 10);
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS ?? '*').split(',').map(s => s.trim());
const HOST          = '127.0.0.1'; // 只绑定本机，不对外暴露

// ============================================================
// Express 配置
// ============================================================
const app = express();

app.use(express.json());

// CORS - 只允许扩展 Origin
app.use((req, res, next) => {
  const origin = req.headers.origin ?? '';
  if (ALLOW_ORIGINS.includes('*') || ALLOW_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/', router);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Unknown endpoint: ${req.method} ${req.path}` });
});

// ============================================================
// HTTP Server
// ============================================================
const server = createServer(app);

// ============================================================
// WebSocket Server（M1 预留，M2 实现 /cdp 和 /extension）
// ============================================================
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${HOST}`);

  // token 鉴权
  if (!verifyWsToken(req)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    console.warn(`[ws] 403 rejected upgrade for ${url.pathname}`);
    return;
  }

  if (url.pathname === '/cdp' || url.pathname === '/extension') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const url  = new URL(req.url, `http://${HOST}`);
  const path = url.pathname;
  console.log(`[ws] new connection: ${path}`);

  // M2 实现桥接逻辑，M1 仅保持连接并 echo 心跳
  ws.on('message', (data) => {
    console.log(`[ws] ${path} received: ${data.toString().slice(0, 120)}`);
    // TODO M2: 转发 CDP 消息
  });

  ws.on('close', () => {
    console.log(`[ws] connection closed: ${path}`);
  });

  ws.on('error', (err) => {
    console.error(`[ws] error on ${path}:`, err.message);
  });

  // 握手确认
  ws.send(JSON.stringify({ type: 'connected', path, ts: Date.now() }));
});

// ============================================================
// 启动
// ============================================================
server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════╗
║   OpenClaw Relay  v0.1.0             ║
║   http://${HOST}:${PORT}           ║
║                                      ║
║   M1: /health /attach /detach        ║
║   M2: WS /cdp  WS /extension         ║
╚══════════════════════════════════════╝
  `.trim());
  if (!process.env.TOKEN) {
    console.warn('[relay] ⚠️  TOKEN 未设置，鉴权已禁用（仅限开发环境）');
  }
});

// ============================================================
// 优雅关闭
// ============================================================
function shutdown(signal) {
  console.log(`\n[relay] 收到 ${signal}，正在关闭...`);
  server.close(() => {
    console.log('[relay] 服务已停止');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

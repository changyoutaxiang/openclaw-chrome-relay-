/**
 * Relay HTTP 路由
 * M1: /health, /attach, /detach
 * M2: /cdp (WS), /extension (WS)
 */
import { Router } from 'express';
import { authMiddleware } from './auth.js';

const router = Router();

// 内存中的 tab 会话表
// sessions: Map<tabId, { attachedAt, status }>
const sessions = new Map();

// ============================================================
// GET /health
// 不需要 token（用于 options 页面显示连接状态）
// 实际上加了 token 也能通过（见 options.js 的 checkHealth）
// ============================================================
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    version: '0.1.0',
    uptime: process.uptime(),
    sessions: sessions.size,
    ts: Date.now(),
  });
});

// 以下路由需要 token 鉴权
router.use(authMiddleware);

// ============================================================
// POST /attach
// Body: { tabId: number }
// 由 Chrome 扩展在 chrome.debugger.attach 成功后调用
// ============================================================
router.post('/attach', (req, res) => {
  const { tabId } = req.body ?? {};
  if (!tabId || typeof tabId !== 'number') {
    return res.status(400).json({ ok: false, error: 'tabId (number) required' });
  }

  sessions.set(tabId, { attachedAt: Date.now(), status: 'attached' });
  console.log(`[relay] tab ${tabId} attached (total sessions: ${sessions.size})`);

  res.json({ ok: true, tabId, sessions: sessions.size });
});

// ============================================================
// POST /detach
// Body: { tabId: number }
// 由 Chrome 扩展在 detach 时调用（包括 debugger.onDetach 触发的情况）
// ============================================================
router.post('/detach', (req, res) => {
  const { tabId } = req.body ?? {};
  if (!tabId || typeof tabId !== 'number') {
    return res.status(400).json({ ok: false, error: 'tabId (number) required' });
  }

  const existed = sessions.has(tabId);
  sessions.delete(tabId);
  console.log(`[relay] tab ${tabId} detached (existed=${existed}, sessions: ${sessions.size})`);

  res.json({ ok: true, tabId, existed });
});

// ============================================================
// GET /sessions（调试用，仅内部可见）
// ============================================================
router.get('/sessions', (req, res) => {
  const list = [];
  for (const [tabId, info] of sessions) {
    list.push({ tabId, ...info });
  }
  res.json({ ok: true, sessions: list });
});

export { router, sessions };

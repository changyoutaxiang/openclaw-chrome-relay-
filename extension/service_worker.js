/**
 * OpenClaw Relay - Service Worker (MV3)
 * 职责：attach/detach 当前激活 tab，维护 tab->session 映射，badge 状态管理
 *
 * Badge 状态：
 *   ON    (绿底白字) - 已成功 attach
 *   ...   (灰底白字) - 正在 attaching
 *   !     (红底白字) - 出现错误
 *   空    (无 badge) - 未 attach
 */

// ============================================================
// Badge 辅助
// ============================================================
const BADGE = {
  ON:      { text: 'ON',  color: '#22c55e' },
  LOADING: { text: '...', color: '#94a3b8' },
  ERROR:   { text: '!',   color: '#ef4444' },
  OFF:     { text: '',    color: '#00000000' },
};

function setBadge(tabId, state) {
  const { text, color } = BADGE[state] ?? BADGE.OFF;
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
}

// ============================================================
// 状态存储（内存，跨事件靠 chrome.storage.session 持久）
// tabSessions: Map<tabId, { debuggeeTabId, status, lastError }>
// ============================================================
const tabSessions = new Map();

async function loadSessions() {
  try {
    const { sessions } = await chrome.storage.session.get('sessions');
    if (sessions) {
      for (const [k, v] of Object.entries(sessions)) {
        tabSessions.set(Number(k), v);
      }
    }
  } catch (_) { /* storage.session 不可用时忽略 */ }
}

async function persistSessions() {
  try {
    const obj = {};
    for (const [k, v] of tabSessions) obj[k] = v;
    await chrome.storage.session.set({ sessions: obj });
  } catch (_) { }
}

// ============================================================
// 读取 relay 配置（port + token）
// ============================================================
async function getConfig() {
  const { relayPort = '9223', relayToken = '' } =
    await chrome.storage.local.get(['relayPort', 'relayToken']);
  return { port: relayPort, token: relayToken };
}

// ============================================================
// 通知 Relay：attach / detach
// ============================================================
async function notifyRelayAttach(tabId, config) {
  const url = `http://127.0.0.1:${config.port}/attach`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
    },
    body: JSON.stringify({ tabId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Relay /attach failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function notifyRelayDetach(tabId, config) {
  const url = `http://127.0.0.1:${config.port}/detach`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
    },
    body: JSON.stringify({ tabId }),
  });
  // detach 失败不阻塞流程，仅记录
  if (!res.ok) {
    console.warn(`[relay] /detach returned ${res.status}`);
  }
}

// ============================================================
// 核心：Attach
// ============================================================
async function attachTab(tabId) {
  const existing = tabSessions.get(tabId);
  if (existing?.status === 'attached') {
    console.log(`[sw] tab ${tabId} already attached`);
    return;
  }

  setBadge(tabId, 'LOADING');
  tabSessions.set(tabId, { status: 'attaching', lastError: null });
  await persistSessions();

  try {
    // 1. chrome debugger attach
    await chrome.debugger.attach({ tabId }, '1.3');

    // 2. 通知 relay
    const config = await getConfig();
    await notifyRelayAttach(tabId, config);

    // 3. 成功
    tabSessions.set(tabId, { status: 'attached', lastError: null });
    await persistSessions();
    setBadge(tabId, 'ON');
    console.log(`[sw] tab ${tabId} attached`);

  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error(`[sw] attach failed for tab ${tabId}:`, msg);
    tabSessions.set(tabId, { status: 'error', lastError: msg });
    await persistSessions();
    setBadge(tabId, 'ERROR');
  }
}

// ============================================================
// 核心：Detach
// ============================================================
async function detachTab(tabId) {
  const session = tabSessions.get(tabId);
  if (!session || session.status === 'detached') return;

  try {
    await chrome.debugger.detach({ tabId });
  } catch (err) {
    // 如果 tab 已经关闭，debugger.detach 会报错，忽略
    console.warn(`[sw] debugger.detach error for tab ${tabId}:`, err?.message);
  }

  try {
    const config = await getConfig();
    await notifyRelayDetach(tabId, config);
  } catch (_) { }

  tabSessions.set(tabId, { status: 'detached', lastError: null });
  await persistSessions();
  setBadge(tabId, 'OFF');
  console.log(`[sw] tab ${tabId} detached`);
}

// ============================================================
// 切换（popup 点击 attach/detach 按钮时使用消息通信）
// ============================================================
async function toggleTab(tabId) {
  const session = tabSessions.get(tabId);
  if (session?.status === 'attached') {
    await detachTab(tabId);
  } else {
    await attachTab(tabId);
  }
}

// ============================================================
// 监听来自 popup 的消息
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    const session = tabSessions.get(msg.tabId) ?? { status: 'detached', lastError: null };
    sendResponse({ ok: true, session });
    return false; // 同步回复
  }

  if (msg.type === 'TOGGLE') {
    toggleTab(msg.tabId)
      .then(() => {
        const session = tabSessions.get(msg.tabId);
        sendResponse({ ok: true, session });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // 异步回复
  }
});

// ============================================================
// 监听 debugger 断开事件（tab 关闭/Chrome 主动断开）
// ============================================================
chrome.debugger.onDetach.addListener(async (source, reason) => {
  const tabId = source.tabId;
  if (!tabId) return;
  console.log(`[sw] debugger detached from tab ${tabId}, reason: ${reason}`);

  const isError = reason !== 'target_closed';
  tabSessions.set(tabId, {
    status: isError ? 'error' : 'detached',
    lastError: isError ? `Debugger detached: ${reason}` : null,
  });
  await persistSessions();
  setBadge(tabId, isError ? 'ERROR' : 'OFF');

  // 通知 relay
  try {
    const config = await getConfig();
    await notifyRelayDetach(tabId, config);
  } catch (_) { }
});

// ============================================================
// Tab 关闭时清理
// ============================================================
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabSessions.has(tabId)) {
    tabSessions.delete(tabId);
    await persistSessions();
  }
});

// ============================================================
// 初始化：从 storage 恢复会话
// ============================================================
loadSessions().then(() => {
  console.log('[sw] OpenClaw Relay service worker started');
});

/**
 * Token 鉴权中间件
 * 支持 header（Authorization: Bearer <token>）和 query（?token=<token>）双通道
 */

const TOKEN = process.env.TOKEN ?? '';

/**
 * Express 中间件：验证 Bearer token
 */
export function authMiddleware(req, res, next) {
  // 如果没有配置 token，跳过鉴权（开发模式）
  if (!TOKEN) {
    console.warn('[auth] 警告：TOKEN 未配置，跳过鉴权');
    return next();
  }

  const provided = extractToken(req);
  if (!provided) {
    return res.status(401).json({ ok: false, error: 'Missing token' });
  }
  if (!safeCompare(provided, TOKEN)) {
    return res.status(403).json({ ok: false, error: 'Invalid token' });
  }
  next();
}

/**
 * 从请求中提取 token（header 优先，其次 query）
 */
export function extractToken(req) {
  const authHeader = req.headers['authorization'] ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.query?.token ?? null;
}

/**
 * 时序安全的字符串比较（防止 timing attack）
 */
function safeCompare(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 验证 WebSocket 升级请求中的 token
 * 返回 true/false
 */
export function verifyWsToken(req) {
  if (!TOKEN) return true; // 开发模式跳过
  const provided = extractToken(req);
  return provided ? safeCompare(provided, TOKEN) : false;
}

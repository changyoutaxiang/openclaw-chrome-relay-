# openclaw-chrome-relay

## 项目用途
OpenClaw 自研 Chrome Relay（路线 2）。通过 Chrome MV3 扩展 + 本地 Relay 服务，构建可完全控制的浏览器接管链路，替代不稳定的第三方 relay。

## 目录结构
```
extension/        Chrome MV3 扩展（attach/detach 当前 tab，badge 状态）
relay/            本地 Relay 服务（Node.js，CDP 桥接，token 鉴权）
docs/             设计文档
tests/            E2E 测试脚本
```

## 快速启动

### 1. 启动 Relay
```bash
cd relay
cp .env.example .env   # 编辑 PORT 和 TOKEN
npm install
npm run dev
```

### 2. 加载扩展
Chrome → 扩展管理 → 开发者模式 → 加载已解压扩展 → 选择 `extension/` 目录

### 3. 配置扩展
点击扩展图标旁的选项 → 填入与 `.env` 一致的 `port` 和 `token` → 保存

### 4. Attach 标签页
在目标标签页点击扩展 toolbar 图标 → badge 变为 `ON` 表示成功

## Badge 状态说明
| Badge | 含义 |
|-------|------|
| `ON`  | 已成功 attach |
| `...` | 正在 attaching |
| `!`   | 出现错误（点击查看 popup 详情） |
| 空    | 未 attach |

## 里程碑
- **M1（当前）**：项目骨架 + 扩展最小 attach/detach + relay /health + token 校验
- **M2**：/cdp & /extension 双向 WebSocket 桥接 + OpenClaw browser profile 打通
- **M3**：可靠性、错误码体系、日志规范、回归测试

## 关键配置
- `relay.port`：默认 9223
- `relay.token`：与 OpenClaw gateway token 同值（后续可拆分）
- `relay.allowOrigins`：扩展的 chrome-extension://id origin

## 依赖
- Node.js >= 18
- Chrome >= 120（MV3）

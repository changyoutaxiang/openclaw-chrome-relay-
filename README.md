# OpenClaw Chrome Extension Relay

✅ **已验证可用：OpenClaw 官方扩展 + Gateway 内置 relay**

## 当前状态

- ✅ Relay 运行在 `http://127.0.0.1:18892`（由 OpenClaw Gateway 自动管理）
- ✅ 扩展已连接并成功 attach Chrome tab
- ✅ OpenClaw `browser` 工具可以看到 tabs 并操作 Google Docs

---

## 快速开始

### 1. 加载扩展

在 Chrome 打开 `chrome://extensions`：
- 开启 **Developer mode**
- 点击 **Load unpacked**
- 选择本仓库的 `extension/` 目录

### 2. 配置扩展

扩展会自动打开 Options 页面，填写：
- **Relay port**: `18892`
- **Gateway token**: 从 `~/.openclaw/openclaw.json` 里复制 `gateway.auth.token` 的值

获取 token 命令：
```bash
python3 -c "import json; d=json.load(open('~/.openclaw/openclaw.json'.replace('~','/Users/你的用户名'))); print(d['gateway']['auth']['token'])"
```

### 3. Attach Tab

在任意 Chrome tab 上点击扩展图标，badge 变成红色 `ON` 即表示成功。

### 4. 使用 OpenClaw Browser 工具

```bash
# 列出已 attach 的 tabs
openclaw browser tabs --browser-profile custom-relay

# 截取页面快照
openclaw browser snapshot --browser-profile custom-relay

# 导航到 URL
openclaw browser navigate "https://example.com" --browser-profile custom-relay
```

---

## 配置说明

### OpenClaw 配置文件 (`~/.openclaw/openclaw.json`)

确保有以下 profile：

```json
{
  "browser": {
    "profiles": {
      "custom-relay": {
        "cdpUrl": "http://127.0.0.1:18892",
        "driver": "extension",
        "color": "#7c3aed"
      }
    }
  }
}
```

---

## 架构说明

```
OpenClaw CLI/Agent
      ↓ browser 工具
Gateway (内置 extension relay @ :18892)
      ↓ WS /extension + /cdp
Chrome Extension (官方)
      ↓ chrome.debugger API
Chrome Tab (e.g. Google Docs)
```

**关键点**：
- Gateway 自动管理 relay，无需单独启动 `node server.js`
- Extension 使用 HMAC 派生的 relay token（基于 gateway token）
- `/json/version` 和 `/json/list` 符合 CDP 协议，OpenClaw 可直接识别 tabs

---

## 故障排查

### 扩展 badge 显示红色 `!`
→ Relay 未启动或 token 错误，检查：
```bash
curl http://127.0.0.1:18892/json/version
```

### `openclaw browser tabs` 返回空
→ 扩展未 attach tab，点击扩展图标 attach 当前 tab

### 扩展 Options 页面报错
→ 确认 gateway token 正确，且 OpenClaw Gateway 在运行

---

## 文件说明

- `extension/` - OpenClaw 官方 Chrome 扩展（从 node_modules 同步）
- `relay/` - 自研 relay（已弃用，改用 Gateway 内置）
- `README.md` - 本文档

---

## 致谢

基于 OpenClaw 官方扩展（v0.1.0）实现，relay 协议参考官方源码。

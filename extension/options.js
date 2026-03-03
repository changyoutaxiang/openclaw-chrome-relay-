const portEl      = document.getElementById('port');
const tokenEl     = document.getElementById('token');
const saveBtn     = document.getElementById('save');
const statusEl    = document.getElementById('status');
const dotEl       = document.getElementById('dot');
const healthText  = document.getElementById('healthText');

// 加载已保存配置
chrome.storage.local.get(['relayPort', 'relayToken'], ({ relayPort = '9223', relayToken = '' }) => {
  portEl.value  = relayPort;
  tokenEl.value = relayToken;
  checkHealth(relayPort, relayToken);
});

// 保存并重新检测
saveBtn.addEventListener('click', async () => {
  const port  = portEl.value.trim()  || '9223';
  const token = tokenEl.value.trim();
  await chrome.storage.local.set({ relayPort: port, relayToken: token });
  showStatus('已保存', 'ok');
  checkHealth(port, token);
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className   = type;
  statusEl.style.display = 'block';
  setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
}

async function checkHealth(port, token) {
  dotEl.className  = 'dot grey';
  healthText.textContent = '正在检测 relay...';
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      dotEl.className  = 'dot green';
      healthText.textContent = `Relay 在线 (v${data.version ?? '?'})`;
    } else {
      dotEl.className  = 'dot red';
      healthText.textContent = `Relay 返回 ${res.status}（检查 token 是否正确）`;
    }
  } catch (e) {
    dotEl.className  = 'dot red';
    healthText.textContent = `无法连接 relay（${e.message}）`;
  }
}

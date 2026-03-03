const badgeEl     = document.getElementById('badge');
const tabInfoEl   = document.getElementById('tabInfo');
const errorMsgEl  = document.getElementById('errorMsg');
const toggleBtn   = document.getElementById('toggleBtn');
const optionsLink = document.getElementById('optionsLink');

let currentTabId = null;

const STATUS_LABEL = {
  attached:  { text: 'ON',        cls: 'attached' },
  attaching: { text: '...',       cls: 'loading'  },
  error:     { text: '错误',      cls: 'error'    },
  detached:  { text: '未连接',    cls: 'detached' },
};

function renderSession(session) {
  const { text, cls } = STATUS_LABEL[session.status] ?? STATUS_LABEL.detached;
  badgeEl.textContent = text;
  badgeEl.className   = `badge ${cls}`;

  if (session.status === 'error' && session.lastError) {
    errorMsgEl.textContent = session.lastError;
    errorMsgEl.style.display = 'block';
  } else {
    errorMsgEl.style.display = 'none';
  }

  const isAttached = session.status === 'attached';
  const isBusy     = session.status === 'attaching';
  toggleBtn.textContent = isAttached ? 'Detach' : 'Attach';
  toggleBtn.className   = isAttached ? 'detach'  : 'attach';
  toggleBtn.disabled    = isBusy;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { tabInfoEl.textContent = '无活动标签页'; return; }

  currentTabId = tab.id;
  tabInfoEl.textContent = tab.title || tab.url || `Tab ${tab.id}`;

  chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: tab.id }, (res) => {
    if (chrome.runtime.lastError) {
      tabInfoEl.textContent = 'Service worker 未响应';
      return;
    }
    renderSession(res.session);
  });
}

toggleBtn.addEventListener('click', () => {
  if (!currentTabId) return;
  toggleBtn.disabled = true;
  toggleBtn.textContent = '...';

  chrome.runtime.sendMessage({ type: 'TOGGLE', tabId: currentTabId }, (res) => {
    if (chrome.runtime.lastError || !res?.ok) {
      renderSession({ status: 'error', lastError: res?.error ?? '未知错误' });
      return;
    }
    renderSession(res.session);
  });
});

optionsLink.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

init();

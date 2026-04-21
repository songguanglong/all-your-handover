(function() {
  const API_BASE = '/api/h5';
  const POLL_INTERVAL = 5000;

  let channelCode = '';
  let editing = false;
  let currentUser = null;
  let toastTimer = null;
  let knownMsgIds = new Set();
  let pendingNewItems = [];
  let assignedItems = new Set();
  let pollTimer = null;
  let lastAnalysisUpdate = '';
  let eventSource = null;

  function getChannelCode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || '';
  }

  async function authenticate() {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code');
    if (authCode) {
      try {
        const res = await fetch(API_BASE + '/auth/feishu?code=' + encodeURIComponent(authCode));
        const data = await res.json();
        if (data.code === 0 && data.data) {
          currentUser = data.data;
          sessionStorage.setItem('h5_user', JSON.stringify(currentUser));
          return;
        }
      } catch (err) {
        console.error('认证失败:', err);
      }
    }
    var cached = sessionStorage.getItem('h5_user');
    if (cached) {
      try { currentUser = JSON.parse(cached); } catch {}
    }
  }

  function showError(msg) {
    var el = document.getElementById('error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError() {
    document.getElementById('error').style.display = 'none';
  }

  function showSavedToast() {
    var el = document.getElementById('savedToast');
    el.style.display = 'inline-block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { el.style.display = 'none'; }, 3000);
  }

  function renderMarkdown(text) {
    return text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function urgencyLabel(u) {
    var map = { high: '紧急', normal: '一般', low: '低' };
    return map[u] || '一般';
  }

  function urgencyTagClass(u) {
    var map = { high: 'tag-urgency-high', normal: 'tag-urgency-normal', low: 'tag-urgency-low' };
    return map[u] || 'tag-urgency-normal';
  }

  function detectNewItems(items) {
    var newItems = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!knownMsgIds.has(item.msgId) && !assignedItems.has(item.msgId) && item.shift !== 'next') {
        newItems.push(item);
      }
    }
    return newItems;
  }

  function renderNewMessages() {
    var area = document.getElementById('newMessagesArea');
    var body = document.getElementById('newMsgBody');
    var badge = document.getElementById('newMsgBadge');

    if (pendingNewItems.length === 0) {
      area.style.display = 'none';
      return;
    }

    area.style.display = 'block';
    badge.textContent = pendingNewItems.length;

    body.innerHTML = pendingNewItems.map(function(item) {
      return '<div class="new-msg-item" id="newMsg-' + item.msgId + '">' +
        '<div class="new-msg-sender">新消息</div>' +
        '<div class="new-msg-content">' + escapeHtml(item.content) + '</div>' +
        '<div class="new-msg-analysis">' +
          '<span class="tag tag-category">' + escapeHtml(item.category) + '</span>' +
          '<span class="tag ' + urgencyTagClass(item.urgency) + '">' + urgencyLabel(item.urgency) + '</span>' +
        '</div>' +
        '<div class="new-msg-actions">' +
          '<button class="btn-include" onclick="window.H5.assignShift(\'' + item.msgId + '\', \'current\')">纳入交接 ✓</button>' +
          '<button class="btn-exclude" onclick="window.H5.assignShift(\'' + item.msgId + '\', \'next\')">归入下一班 →</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function toggleNewMessages() {
    var body = document.getElementById('newMsgBody');
    var arrow = document.getElementById('newMsgArrow');
    if (body.classList.contains('collapsed')) {
      body.classList.remove('collapsed');
      arrow.classList.remove('collapsed');
    } else {
      body.classList.add('collapsed');
      arrow.classList.add('collapsed');
    }
  }

  async function assignShift(msgId, shift) {
    var itemEl = document.getElementById('newMsg-' + msgId);
    if (itemEl) {
      var buttons = itemEl.querySelectorAll('button');
      buttons.forEach(function(b) { b.disabled = true; });
    }

    try {
      var res = await fetch(API_BASE + '/draft/' + channelCode + '/assign-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgId: msgId, shift: shift }),
      });
      var data = await res.json();
      if (data.code === 0) {
        pendingNewItems = pendingNewItems.filter(function(i) { return i.msgId !== msgId; });
        assignedItems.add(msgId);
        knownMsgIds.add(msgId);
        renderNewMessages();
        await refreshFromServer();
      } else {
        showError(data.message || '操作失败');
        if (itemEl) {
          var btns = itemEl.querySelectorAll('button');
          btns.forEach(function(b) { b.disabled = false; });
        }
      }
    } catch (err) {
      showError('网络错误');
      if (itemEl) {
        var btns2 = itemEl.querySelectorAll('button');
        btns2.forEach(function(b) { b.disabled = false; });
      }
    }
  }

  async function refreshFromServer() {
    hideError();
    try {
      var res = await fetch(API_BASE + '/draft/' + channelCode);
      var data = await res.json();
      if (data.code !== 0) {
        showError(data.message || '刷新失败');
        return;
      }

      var d = data.data;

      var compEl = document.getElementById('completeness');
      if (d.missingCount > 0) {
        compEl.textContent = '还有 ' + d.missingCount + ' 条消息未分析（共 ' + d.rawCount + ' 条）';
        compEl.className = 'completeness';
      } else {
        compEl.textContent = '全部 ' + d.rawCount + ' 条消息已分析';
        compEl.className = 'completeness ok';
      }
      compEl.style.display = 'block';

      if (!editing) {
        document.getElementById('previewDisplay').innerHTML = renderMarkdown(d.preview || '暂无内容');
        document.getElementById('editorArea').value = d.preview || '';
      }

      var currentItems = d.items || [];
      for (var i = 0; i < currentItems.length; i++) {
        knownMsgIds.add(currentItems[i].msgId);
      }
      lastAnalysisUpdate = d.lastUpdated || '';

      document.getElementById('updateBanner').style.display = 'none';

      await checkPendingState();
    } catch (err) {
      showError('刷新失败');
    }
  }

  async function loadDraft() {
    hideError();
    try {
      var res = await fetch(API_BASE + '/draft/' + channelCode);
      var data = await res.json();
      if (data.code !== 0) {
        showError(data.message || '加载失败');
        return;
      }

      var d = data.data;
      document.getElementById('status').style.display = 'none';
      document.getElementById('content').style.display = 'block';

      var compEl = document.getElementById('completeness');
      if (d.missingCount > 0) {
        compEl.textContent = '还有 ' + d.missingCount + ' 条消息未分析（共 ' + d.rawCount + ' 条）';
        compEl.className = 'completeness';
      } else {
        compEl.textContent = '全部 ' + d.rawCount + ' 条消息已分析';
        compEl.className = 'completeness ok';
      }
      compEl.style.display = 'block';

      document.getElementById('previewDisplay').innerHTML = renderMarkdown(d.preview || '暂无内容');
      document.getElementById('editorArea').value = d.preview || '';

      var items = d.items || [];
      for (var i = 0; i < items.length; i++) {
        knownMsgIds.add(items[i].msgId);
        if (items[i].shift === 'next') {
          assignedItems.add(items[i].msgId);
        }
      }
      lastAnalysisUpdate = d.lastUpdated || '';

      await checkPendingState();
      startPolling();
    } catch (err) {
      showError('网络错误，请重试');
    }
  }

  async function checkPendingState() {
    try {
      var res = await fetch(API_BASE + '/handover/' + channelCode + '/pending');
      if (res.ok) {
        var data = await res.json();
        if (data.code === 0 && data.data) {
          showPendingView(data.data);
          return;
        }
      }
      document.getElementById('draftView').style.display = 'block';
      document.getElementById('pendingView').style.display = 'none';
    } catch {
      document.getElementById('draftView').style.display = 'block';
      document.getElementById('pendingView').style.display = 'none';
    }
  }

  function showPendingView(pending) {
    document.getElementById('draftView').style.display = 'none';
    document.getElementById('pendingView').style.display = 'block';
    document.getElementById('senderInfo').textContent = '交班人: ' + (pending.sender ? pending.sender.name || '未知' : '未知');
    document.getElementById('createdAtInfo').textContent = '时间: ' + (pending.createdAt || '');
    document.getElementById('pendingPreview').innerHTML = renderMarkdown(pending.content || '');
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    trySSE();
    pollTimer = setInterval(pollForUpdates, POLL_INTERVAL);
  }

  function trySSE() {
    if (eventSource) { eventSource.close(); eventSource = null; }
    try {
      eventSource = new EventSource(API_BASE + '/draft/' + channelCode + '/events');
      eventSource.addEventListener('update', function() {
        pollForUpdates();
      });
      eventSource.onerror = function() {
        if (eventSource) { eventSource.close(); eventSource = null; }
      };
    } catch {
      // SSE not supported — polling continues as fallback
    }
  }

  async function pollForUpdates() {
    try {
      var statusRes = await fetch(API_BASE + '/draft/' + channelCode + '/status');
      var statusData = await statusRes.json();
      if (statusData.code !== 0) return;

      var s = statusData.data;

      if (s.lastUpdated === lastAnalysisUpdate) {
        var compEl = document.getElementById('completeness');
        if (s.missingCount > 0) {
          compEl.textContent = '还有 ' + s.missingCount + ' 条消息未分析（共 ' + s.rawCount + ' 条）';
          compEl.className = 'completeness';
        } else {
          compEl.textContent = '全部 ' + s.rawCount + ' 条消息已分析';
          compEl.className = 'completeness ok';
        }
        return;
      }

      var res = await fetch(API_BASE + '/draft/' + channelCode);
      var data = await res.json();
      if (data.code !== 0) return;

      var d = data.data;
      var items = d.items || [];

      var newItems = detectNewItems(items);
      if (newItems.length > 0) {
        pendingNewItems = pendingNewItems.concat(newItems);
        renderNewMessages();

        if (!editing) {
          document.getElementById('previewDisplay').innerHTML = renderMarkdown(d.preview || '暂无内容');
          document.getElementById('editorArea').value = d.preview || '';
        } else {
          var banner = document.getElementById('updateBanner');
          banner.style.display = 'flex';
          document.getElementById('updateBannerText').textContent = '有 ' + newItems.length + ' 条新消息已分析完成';
        }

        for (var i = 0; i < items.length; i++) {
          knownMsgIds.add(items[i].msgId);
        }
      } else if (!editing) {
        document.getElementById('previewDisplay').innerHTML = renderMarkdown(d.preview || '暂无内容');
        document.getElementById('editorArea').value = d.preview || '';
      }

      var compEl2 = document.getElementById('completeness');
      if (d.missingCount > 0) {
        compEl2.textContent = '还有 ' + d.missingCount + ' 条消息未分析（共 ' + d.rawCount + ' 条）';
        compEl2.className = 'completeness';
      } else {
        compEl2.textContent = '全部 ' + d.rawCount + ' 条消息已分析';
        compEl2.className = 'completeness ok';
      }

      lastAnalysisUpdate = d.lastUpdated || '';
    } catch {
      // Silent fail on poll errors
    }
  }

  function switchToView() {
    editing = false;
    document.getElementById('previewDisplay').style.display = 'block';
    document.getElementById('previewEditor').style.display = 'none';
    document.getElementById('viewBtn').classList.add('active');
    document.getElementById('editBtn').classList.remove('active');
    document.getElementById('updateBanner').style.display = 'none';
    refreshFromServer();
  }

  function switchToEdit() {
    editing = true;
    document.getElementById('previewDisplay').style.display = 'none';
    document.getElementById('previewEditor').style.display = 'block';
    document.getElementById('editBtn').classList.add('active');
    document.getElementById('viewBtn').classList.remove('active');
    document.getElementById('editorArea').focus();
  }

  async function saveDraft() {
    var content = editing ? document.getElementById('editorArea').value : undefined;
    if (!editing) return;
    if (!content && editing) return;

    try {
      var res = await fetch(API_BASE + '/draft/' + channelCode + '/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content }),
      });
      var data = await res.json();
      if (data.code === 0) {
        showSavedToast();
        document.getElementById('updateBanner').style.display = 'none';
      } else {
        showError(data.message || '保存失败');
      }
    } catch (err) {
      showError('网络错误');
    }
  }

  var bulkAssignChoices = {}; // msgId -> 'current' | 'next'

  async function startHandover() {
    if (editing) {
      var content = document.getElementById('editorArea').value;
      try {
        var saveRes = await fetch(API_BASE + '/draft/' + channelCode + '/preview', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content }),
        });
        var saveData = await saveRes.json();
        if (saveData.code !== 0) {
          showError('保存草稿失败: ' + (saveData.message || '未知错误'));
          return;
        }
      } catch (err) {
        showError('保存草稿失败，请重试');
        return;
      }
    }

    if (pendingNewItems.length > 0) {
      // Show bulk assign modal instead of simple confirm
      showBulkAssignModal();
      return;
    }

    if (!confirm('确认发起交班？')) return;
    doStartHandover();
  }

  function showBulkAssignModal() {
    bulkAssignChoices = {};
    var list = document.getElementById('bulkAssignList');
    list.innerHTML = pendingNewItems.map(function(item) {
      bulkAssignChoices[item.msgId] = 'current';
      return '<div class="modal-item" id="modalItem-' + item.msgId + '">' +
        '<div class="modal-item-content">' +
          '<div class="item-text">' + escapeHtml(item.content) + '</div>' +
          '<div class="item-meta">' + escapeHtml(item.category) + ' · ' + urgencyLabel(item.urgency) + '</div>' +
        '</div>' +
        '<div class="item-actions">' +
          '<button class="btn-this-shift selected" id="btnThis-' + item.msgId + '" onclick="window.H5.setBulkChoice(\'' + item.msgId + '\', \'current\')">本班 ✓</button>' +
          '<button class="btn-next-shift" id="btnNext-' + item.msgId + '" onclick="window.H5.setBulkChoice(\'' + item.msgId + '\', \'next\')">下班 →</button>' +
        '</div>' +
      '</div>';
    }).join('');
    document.getElementById('bulkAssignModal').style.display = 'flex';
  }

  function setBulkChoice(msgId, shift) {
    bulkAssignChoices[msgId] = shift;
    var thisBtn = document.getElementById('btnThis-' + msgId);
    var nextBtn = document.getElementById('btnNext-' + msgId);
    if (shift === 'current') {
      thisBtn.classList.add('selected');
      nextBtn.classList.remove('selected');
    } else {
      nextBtn.classList.add('selected');
      thisBtn.classList.remove('selected');
    }
  }

  function cancelBulkAssign() {
    document.getElementById('bulkAssignModal').style.display = 'none';
  }

  async function confirmBulkAssign() {
    var confirmBtn = document.getElementById('bulkAssignConfirmBtn');
    confirmBtn.disabled = true;

    try {
      for (var i = 0; i < pendingNewItems.length; i++) {
        var item = pendingNewItems[i];
        var shift = bulkAssignChoices[item.msgId] || 'current';
        try {
          await fetch(API_BASE + '/draft/' + channelCode + '/assign-shift', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msgId: item.msgId, shift: shift }),
          });
        } catch {}
      }
      pendingNewItems = [];
      renderNewMessages();
      document.getElementById('bulkAssignModal').style.display = 'none';

      if (!confirm('确认发起交班？')) return;
      doStartHandover();
    } finally {
      confirmBtn.disabled = false;
    }
  }

  async function doStartHandover() {
    var body = {};
    if (currentUser) {
      body.senderId = currentUser.open_id;
      body.senderName = currentUser.name;
    }
    try {
      var res = await fetch(API_BASE + '/handover/' + channelCode + '/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await res.json();
      if (data.code === 0) {
        alert('交班已发起');
        if (pollTimer) clearInterval(pollTimer);
        if (eventSource) { eventSource.close(); eventSource = null; }
        location.reload();
      } else {
        showError(data.message || (data.data && data.data.message) || '交班失败');
      }
    } catch (err) {
      showError('网络错误');
    }
  }

  async function acceptHandover() {
    if (!confirm('确认接班？')) return;
    var body = {};
    if (currentUser) {
      body.receiverId = currentUser.open_id;
      body.receiverName = currentUser.name;
    }
    try {
      var res = await fetch(API_BASE + '/handover/' + channelCode + '/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      var data = await res.json();
      if (data.code === 0) {
        alert('接班确认成功');
        if (pollTimer) clearInterval(pollTimer);
        if (eventSource) { eventSource.close(); eventSource = null; }
        location.reload();
      } else {
        showError(data.message || (data.data && data.data.message) || '接班确认失败');
      }
    } catch (err) {
      showError('网络错误');
    }
  }

  async function rejectHandover() {
    if (!confirm('确认打回？交班人需要重新编辑草稿。')) return;
    try {
      var res = await fetch(API_BASE + '/handover/' + channelCode + '/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      var data = await res.json();
      if (data.code === 0) {
        alert('已打回');
        if (pollTimer) clearInterval(pollTimer);
        if (eventSource) { eventSource.close(); eventSource = null; }
        location.reload();
      } else {
        showError(data.message || '打回失败');
      }
    } catch (err) {
      showError('网络错误');
    }
  }

  // Expose functions needed by inline event handlers
  window.H5 = {
    assignShift: assignShift,
    toggleNewMessages: toggleNewMessages,
    switchToView: switchToView,
    switchToEdit: switchToEdit,
    saveDraft: saveDraft,
    startHandover: startHandover,
    acceptHandover: acceptHandover,
    rejectHandover: rejectHandover,
    refreshFromServer: refreshFromServer,
    setBulkChoice: setBulkChoice,
    cancelBulkAssign: cancelBulkAssign,
    confirmBulkAssign: confirmBulkAssign,
  };

  // Init
  channelCode = getChannelCode();
  if (!channelCode) {
    document.getElementById('status').textContent = '缺少渠道参数';
  } else {
    authenticate().then(function() { loadDraft(); });
  }

  window.addEventListener('beforeunload', function() {
    if (pollTimer) clearInterval(pollTimer);
    if (eventSource) { eventSource.close(); eventSource = null; }
  });

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    } else {
      pollForUpdates();
      startPolling();
    }
  });
})();
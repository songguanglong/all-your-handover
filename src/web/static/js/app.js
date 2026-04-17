document.addEventListener('DOMContentLoaded', () => {
  const main = document.getElementById('main-content');
  const navLinks = document.querySelectorAll('.nav-link');

  // Router
  function navigate(hash) {
    const page = (hash || '#wizard').substring(1);
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('data-page') === page));
    renderPage(page);
  }

  window.addEventListener('hashchange', () => navigate(location.hash));
  navigate(location.hash);

  async function renderPage(page) {
    main.innerHTML = '<div class="loading">加载中...</div>';
    switch (page) {
      case 'wizard': await renderWizard(); break;
      case 'llm': await renderLLM(); break;
      case 'platforms': await renderPlatforms(); break;
      case 'channels': await renderChannels(); break;
      case 'template': await renderTemplate(); break;
      case 'handovers': await renderHandovers(); break;
      case 'monitoring': await renderMonitoring(); break;
      default: main.innerHTML = '<div class="card"><h2>404</h2><p>页面不存在</p></div>';
    }
  }

  // --- Wizard ---
  async function renderWizard() {
    const status = await api.get('/status');
    if (!status.data?.firstRun) {
      main.innerHTML = `
        <div class="card">
          <h2>系统已初始化</h2>
          <p>所有配置已完成，请使用左侧菜单管理各项设置。</p>
          <div style="margin-top:12px">
            <p>渠道: ${status.data.channelCount} | Provider: ${status.data.providerCount} | 默认Provider: ${status.data.hasDefaultProvider ? '已配置' : '未配置'}</p>
          </div>
        </div>`;
      return;
    }

    main.innerHTML = `
      <div class="card">
        <h2>欢迎使用 All Your Handover</h2>
        <p>首次使用，请按以下步骤完成初始化配置。</p>
        <div class="steps">
          <div class="step active" id="step1">1. 添加 LLM</div>
          <div class="step" id="step2">2. 配置飞书</div>
          <div class="step" id="step3">3. 添加渠道</div>
          <div class="step" id="step4">4. 完成</div>
        </div>
        <div id="wizard-step-content"></div>
      </div>`;

    await renderWizardStep1();
  }

  async function renderWizardStep1() {
    const el = document.getElementById('wizard-step-content');
    el.innerHTML = `
      <h3>添加 LLM Provider</h3>
      <div class="form-group"><label>名称</label><input id="w-name" value="OpenAI"></div>
      <div class="form-group"><label>类型</label><select id="w-type"><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="moonshot">Moonshot</option></select></div>
      <div class="form-group"><label>API Key</label><input id="w-key" type="password" placeholder="sk-..."></div>
      <div class="form-group"><label>Base URL</label><input id="w-url" value="https://api.openai.com"></div>
      <div class="form-group"><label>模型</label><input id="w-model" value="gpt-4"></div>
      <div class="btn-group"><button class="btn btn-primary" id="w-next1">下一步</button></div>`;

    document.getElementById('w-type').addEventListener('change', (e) => {
      const urlMap = { openai: 'https://api.openai.com', deepseek: 'https://api.deepseek.com', moonshot: 'https://api.moonshot.cn' };
      const modelMap = { openai: 'gpt-4', deepseek: 'deepseek-chat', moonshot: 'moonshot-v1-8k' };
      document.getElementById('w-url').value = urlMap[e.target.value] || '';
      document.getElementById('w-model').value = modelMap[e.target.value] || '';
    });

    document.getElementById('w-next1').addEventListener('click', async () => {
      await api.post('/llm-providers', {
        name: document.getElementById('w-name').value,
        type: document.getElementById('w-type').value,
        apiKey: document.getElementById('w-key').value,
        baseUrl: document.getElementById('w-url').value,
        model: document.getElementById('w-model').value,
        isDefault: true,
      });
      document.getElementById('step1').className = 'step done';
      document.getElementById('step2').className = 'step active';
      await renderWizardStep2();
    });
  }

  async function renderWizardStep2() {
    const el = document.getElementById('wizard-step-content');
    el.innerHTML = `
      <h3>配置飞书应用</h3>
      <div class="form-group"><label>App ID</label><input id="w-appid" placeholder="cli_xxx"></div>
      <div class="form-group"><label>App Secret</label><input id="w-appsecret" type="password"></div>
      <div class="form-group"><label>Verification Token</label><input id="w-vtoken"></div>
      <div class="btn-group"><button class="btn btn-primary" id="w-next2">下一步</button></div>`;

    document.getElementById('w-next2').addEventListener('click', async () => {
      await api.put('/platforms/feishu', {
        appId: document.getElementById('w-appid').value,
        appSecret: document.getElementById('w-appsecret').value,
        verificationToken: document.getElementById('w-vtoken').value,
      });
      document.getElementById('step2').className = 'step done';
      document.getElementById('step3').className = 'step active';
      await renderWizardStep3();
    });
  }

  async function renderWizardStep3() {
    const el = document.getElementById('wizard-step-content');
    el.innerHTML = `
      <h3>添加渠道（群聊）</h3>
      <div class="form-group"><label>渠道代码（英文+数字+下划线）</label><input id="w-chcode" placeholder="qiantai"></div>
      <div class="form-group"><label>渠道名称</label><input id="w-chname" placeholder="前台群"></div>
      <div class="form-group"><label>飞书群 Chat ID</label><input id="w-chatid" placeholder="oc_xxx"></div>
      <div class="btn-group"><button class="btn btn-primary" id="w-next3">完成配置</button></div>`;

    document.getElementById('w-next3').addEventListener('click', async () => {
      await api.post('/channels', {
        code: document.getElementById('w-chcode').value,
        type: 'feishu',
        name: document.getElementById('w-chname').value,
        chatId: document.getElementById('w-chatid').value,
      });
      document.getElementById('step3').className = 'step done';
      document.getElementById('step4').className = 'step active';
      el.innerHTML = `<div class="success">配置完成！所有设置已保存。现在可以开始在群聊中使用交接班功能了。</div>
        <div class="btn-group"><a href="#llm" class="btn btn-default">前往 LLM 设置</a><a href="#monitoring" class="btn btn-primary">查看运行状态</a></div>`;
    });
  }

  // --- LLM ---
  async function renderLLM() {
    const data = await api.get('/llm-providers');
    const providers = data.data?.providers || [];
    const defaultId = data.data?.defaultProviderId;

    let rows = providers.map(p => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.type)}</td>
        <td>${esc(p.model)}</td>
        <td><span class="badge ${p.isEnabled ? 'badge-success' : 'badge-warning'}">${p.isEnabled ? '启用' : '禁用'}</span></td>
        <td>${p.id === defaultId ? '<span class="badge badge-success">默认</span>' : ''}</td>
        <td>
          <button class="btn btn-sm btn-default" onclick="toggleProvider('${p.id}')">切换</button>
          ${p.id !== defaultId ? `<button class="btn btn-sm btn-primary" onclick="setDefault('${p.id}')">设为默认</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteProvider('${p.id}')">删除</button>
        </td>
      </tr>`).join('');

    main.innerHTML = `
      <div class="card">
        <h2>LLM Provider 设置</h2>
        <table><thead><tr><th>名称</th><th>类型</th><th>模型</th><th>状态</th><th>默认</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="6">暂无 Provider</td></tr>'}</tbody></table>
      </div>
      <div class="card">
        <h3>添加新 Provider</h3>
        <div class="form-group"><label>名称</label><input id="p-name"></div>
        <div class="form-group"><label>类型</label><select id="p-type"><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="moonshot">Moonshot</option></select></div>
        <div class="form-group"><label>API Key</label><input id="p-key" type="password"></div>
        <div class="form-group"><label>Base URL</label><input id="p-url" value="https://api.openai.com"></div>
        <div class="form-group"><label>模型</label><input id="p-model" value="gpt-4"></div>
        <div class="btn-group"><button class="btn btn-primary" id="add-provider">添加</button></div>
      </div>`;

    document.getElementById('add-provider').addEventListener('click', async () => {
      await api.post('/llm-providers', {
        name: document.getElementById('p-name').value,
        type: document.getElementById('p-type').value,
        apiKey: document.getElementById('p-key').value,
        baseUrl: document.getElementById('p-url').value,
        model: document.getElementById('p-model').value,
      });
      renderLLM();
    });
  }

  window.toggleProvider = async (id) => { await api.put(`/llm-providers/${id}/toggle`); renderLLM(); };
  window.setDefault = async (id) => { await api.put(`/llm-providers/${id}/default`); renderLLM(); };
  window.deleteProvider = async (id) => { if (confirm('确认删除？')) { await api.del(`/llm-providers/${id}`); renderLLM(); } };

  // --- Platforms ---
  async function renderPlatforms() {
    const data = await api.get('/platforms/feishu');
    const p = data.data || {};

    main.innerHTML = `
      <div class="card">
        <h2>飞书平台配置</h2>
        <div class="form-group"><label>App ID</label><input id="pl-appid" value="${esc(p.appId || '')}"></div>
        <div class="form-group"><label>App Secret</label><input id="pl-appsecret" type="password" placeholder="${p.appSecret ? '已配置（留空保持不变）' : ''}"></div>
        <div class="form-group"><label>Verification Token</label><input id="pl-vtoken" value="${esc(p.verificationToken || '')}"></div>
        <div class="btn-group"><button class="btn btn-primary" id="save-platform">保存</button><button class="btn btn-default" id="test-platform">测试连接</button></div>
        <div id="platform-result"></div>
      </div>`;

    document.getElementById('save-platform').addEventListener('click', async () => {
      const body = {};
      const appId = document.getElementById('pl-appid').value;
      const appSecret = document.getElementById('pl-appsecret').value;
      const vtoken = document.getElementById('pl-vtoken').value;
      if (appId) body.appId = appId;
      if (appSecret) body.appSecret = appSecret;
      if (vtoken) body.verificationToken = vtoken;
      await api.put('/platforms/feishu', body);
      document.getElementById('platform-result').innerHTML = '<div class="success">已保存</div>';
    });

    document.getElementById('test-platform').addEventListener('click', async () => {
      const res = await api.post('/platforms/feishu/test', {});
      document.getElementById('platform-result').innerHTML = res.code === 0 ? '<div class="success">连接成功</div>' : `<div class="error">${res.message}</div>`;
    });
  }

  // --- Channels ---
  async function renderChannels() {
    const data = await api.get('/channels');
    const channels = data.data || [];

    let rows = channels.map(ch => `
      <tr>
        <td>${esc(ch.code)}</td>
        <td>${esc(ch.name)}</td>
        <td>${esc(ch.chatId)}</td>
        <td><span class="badge ${ch.settings.requireAccept ? 'badge-success' : 'badge-warning'}">${ch.settings.requireAccept ? '需确认' : '自动归档'}</span></td>
        <td><span class="badge ${ch.isEnabled ? 'badge-success' : 'badge-warning'}">${ch.isEnabled ? '启用' : '禁用'}</span></td>
        <td>
          <button class="btn btn-sm btn-default" onclick="toggleChannel('${ch.code}')">切换</button>
          <button class="btn btn-sm btn-danger" onclick="deleteChannel('${ch.code}')">删除</button>
        </td>
      </tr>`).join('');

    main.innerHTML = `
      <div class="card">
        <h2>渠道管理</h2>
        <table><thead><tr><th>代码</th><th>名称</th><th>Chat ID</th><th>模式</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="6">暂无渠道</td></tr>'}</tbody></table>
      </div>
      <div class="card">
        <h3>添加新渠道</h3>
        <div class="form-group"><label>渠道代码</label><input id="ch-code" placeholder="qiantai"></div>
        <div class="form-group"><label>渠道名称</label><input id="ch-name" placeholder="前台群"></div>
        <div class="form-group"><label>Chat ID</label><input id="ch-chatid" placeholder="oc_xxx"></div>
        <div class="form-group"><label>需要接班确认</label><select id="ch-accept"><option value="true">是</option><option value="false">否</option></select></div>
        <div class="form-group"><label>消息过滤</label><select id="ch-filter"><option value="all">所有消息</option><option value="mention">仅@机器人</option></select></div>
        <div class="btn-group"><button class="btn btn-primary" id="add-channel">添加</button></div>
      </div>`;

    document.getElementById('add-channel').addEventListener('click', async () => {
      await api.post('/channels', {
        code: document.getElementById('ch-code').value,
        type: 'feishu',
        name: document.getElementById('ch-name').value,
        chatId: document.getElementById('ch-chatid').value,
        settings: { requireAccept: document.getElementById('ch-accept').value === 'true', messageFilter: document.getElementById('ch-filter').value },
      });
      renderChannels();
    });
  }

  window.toggleChannel = async (code) => { await api.put(`/channels/${code}/toggle`); renderChannels(); };
  window.deleteChannel = async (code) => { if (confirm('确认删除？')) { await api.del(`/channels/${code}`); renderChannels(); } };

  // --- Template ---
  async function renderTemplate() {
    const channels = await api.get('/channels');
    const chList = channels.data || [];
    if (chList.length === 0) {
      main.innerHTML = '<div class="card"><h2>模版编辑</h2><p>请先添加渠道。</p></div>';
      return;
    }

    const code = chList[0].code;
    const data = await api.get(`/channels/${code}/template`);

    main.innerHTML = `
      <div class="card">
        <h2>交接模版编辑</h2>
        <div class="form-group"><label>渠道</label><select id="tmpl-channel">${chList.map(ch => `<option value="${ch.code}">${ch.name} (${ch.code})</option>`).join('')}</select></div>
        <div class="form-group"><label>模版内容（Markdown，支持 {{变量名}} 占位符）</label><textarea id="tmpl-content">${data.data?.template || ''}</textarea></div>
        <div class="btn-group"><button class="btn btn-primary" id="save-tmpl">保存</button><button class="btn btn-default" id="reset-tmpl">重置为默认</button></div>
      </div>`;

    document.getElementById('tmpl-channel').addEventListener('change', async (e) => {
      const d = await api.get(`/channels/${e.target.value}/template`);
      document.getElementById('tmpl-content').value = d.data?.template || '';
    });

    document.getElementById('save-tmpl').addEventListener('click', async () => {
      const ch = document.getElementById('tmpl-channel').value;
      await api.put(`/channels/${ch}/template`, { template: document.getElementById('tmpl-content').value });
      alert('模版已保存');
    });

    document.getElementById('reset-tmpl').addEventListener('click', async () => {
      const ch = document.getElementById('tmpl-channel').value;
      const d = await api.put(`/channels/${ch}/template/reset`, {});
      document.getElementById('tmpl-content').value = d.data?.template || '';
    });
  }

  // --- Handovers ---
  async function renderHandovers() {
    const data = await api.get('/handovers?page=1&pageSize=20');
    const records = data.data?.records || [];
    const total = data.data?.total || 0;

    let rows = records.map(r => `
      <tr>
        <td>${esc(r.channel_name || r.channel_code || '')}</td>
        <td>${esc(r.sender_name || (r.sender && r.sender.name) || '')}</td>
        <td>${esc(r.receiver_name || (r.receiver && r.receiver.name) || '-')}</td>
        <td>${esc(r.created_at || '')}</td>
        <td><span class="badge ${r.status === 'completed' ? 'badge-success' : 'badge-warning'}">${r.status || ''}</span></td>
      </tr>`).join('');

    main.innerHTML = `
      <div class="card">
        <h2>交接记录查询</h2>
        <table><thead><tr><th>渠道</th><th>交班人</th><th>接班人</th><th>时间</th><th>状态</th></tr></thead><tbody>${rows || '<tr><td colspan="5">暂无记录</td></tr>'}</tbody></table>
        <div class="pagination"><span class="page-info">共 ${total} 条记录</span></div>
      </div>`;
  }

  // --- Monitoring ---
  async function renderMonitoring() {
    const status = await api.get('/status');
    const s = status.data || {};
    const queue = await api.get('/llm-queue');

    main.innerHTML = `
      <div class="card">
        <h2>运行监控</h2>
        <table>
          <tr><th>项目</th><th>值</th></tr>
          <tr><td>运行状态</td><td><span class="badge badge-success">${s.status || 'ok'}</span></td></tr>
          <tr><td>运行时间</td><td>${Math.floor((s.uptime || 0) / 3600)} 小时</td></tr>
          <tr><td>版本</td><td>${esc(s.version || '-')}</td></tr>
          <tr><td>活跃渠道</td><td>${s.channelCount || 0}</td></tr>
          <tr><td>LLM Provider</td><td>${s.providerCount || 0} (默认: ${s.hasDefaultProvider ? '已配置' : '未配置'})</td></tr>
          <tr><td>LLM 队列</td><td>待处理: ${queue.data?.totalPending || 0}, 活跃: ${queue.data?.activeCalls || 0}</td></tr>
        </table>
      </div>`;
  }
});
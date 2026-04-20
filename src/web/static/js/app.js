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
    try {
      switch (page) {
        case 'wizard': await renderWizard(); break;
        case 'llm': await renderLLM(); break;
        case 'platforms': await renderPlatforms(); break;
        case 'channels': await renderChannels(); break;
        case 'template': await renderTemplate(); break;
        case 'agent': await renderAgent(); break;
        case 'handovers': await renderHandovers(); break;
        case 'monitoring': await renderMonitoring(); break;
        default: main.innerHTML = '<div class="card"><h2>404</h2><p>页面不存在</p></div>';
      }
    } catch (err) {
      main.innerHTML = `<div class="card"><h2>加载失败</h2><div class="error">${esc(err.message)}</div></div>`;
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
      const apiKey = document.getElementById('w-key').value.trim();
      const name = document.getElementById('w-name').value.trim();
      if (!name) { alert('请填写名称'); return; }
      if (!apiKey) { alert('请填写 API Key'); return; }
      const btn = document.getElementById('w-next1');
      try {
        btn.disabled = true;
        await api.post('/llm-providers', {
          name: document.getElementById('w-name').value,
          type: document.getElementById('w-type').value,
          apiKey,
          baseUrl: document.getElementById('w-url').value,
          model: document.getElementById('w-model').value,
          isDefault: true,
        });
        document.getElementById('step1').className = 'step done';
        document.getElementById('step2').className = 'step active';
        await renderWizardStep2();
      } catch (err) {
        alert(`添加 LLM Provider 失败: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
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
      const appId = document.getElementById('w-appid').value.trim();
      const appSecret = document.getElementById('w-appsecret').value.trim();
      const vtoken = document.getElementById('w-vtoken').value.trim();
      if (!appId || !appSecret || !vtoken) { alert('请填写所有飞书配置项'); return; }
      const btn = document.getElementById('w-next2');
      try {
        btn.disabled = true;
        await api.put('/platforms/feishu', {
          appId,
          appSecret,
          verificationToken: vtoken,
        });
        document.getElementById('step2').className = 'step done';
        document.getElementById('step3').className = 'step active';
        await renderWizardStep3();
      } catch (err) {
        alert(`配置飞书失败: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
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
      const code = document.getElementById('w-chcode').value.trim();
      const name = document.getElementById('w-chname').value.trim();
      const chatId = document.getElementById('w-chatid').value.trim();
      if (!code || !name || !chatId) { alert('请填写所有渠道配置项'); return; }
      const btn = document.getElementById('w-next3');
      try {
        btn.disabled = true;
        await api.post('/channels', {
          code,
          type: 'feishu',
          name,
          chatId,
        });
        document.getElementById('step3').className = 'step done';
        document.getElementById('step4').className = 'step active';
      el.innerHTML = `<div class="success">配置完成！所有设置已保存。现在可以开始在群聊中使用交接班功能了。</div>
        <div class="btn-group"><a href="#llm" class="btn btn-default">前往 LLM 设置</a><a href="#monitoring" class="btn btn-primary">查看运行状态</a></div>`;
      } catch (err) {
        alert(`添加渠道失败: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
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

    const placeholders = [
      { name: 'important', desc: '重要事项内容（urgency=high 的消息汇总）' },
      { name: 'normal', desc: '一般事项内容（urgency=normal 的消息汇总）' },
      { name: 'follow_up', desc: '待跟进事项内容（urgency=low 的消息汇总）' },
      { name: 'sender', desc: '交班人姓名' },
      { name: 'receiver', desc: '接班人姓名' },
      { name: 'date', desc: '交接日期' },
      { name: 'channel', desc: '渠道名称' },
    ];

    main.innerHTML = `
      <div class="card">
        <h2>交接模版编辑</h2>
        <div class="form-group"><label>渠道</label><select id="tmpl-channel">${chList.map(ch => `<option value="${ch.code}">${ch.name} (${ch.code})</option>`).join('')}</select></div>
        <div class="form-group">
          <label>可用占位符</label>
          <div class="placeholder-list">${placeholders.map(p => `<span class="badge badge-info" title="${esc(p.desc)}">{{${p.name}}}</span>`).join(' ')}</div>
        </div>
        <div class="form-group"><label>模版内容（Markdown，支持 {{变量名}} 占位符）</label><textarea id="tmpl-content">${data.data?.template || ''}</textarea></div>
        <div id="tmpl-error"></div>
        <div class="btn-group">
          <button class="btn btn-primary" id="save-tmpl">保存</button>
          <button class="btn btn-default" id="reset-tmpl">重置为默认</button>
          <button class="btn btn-default" id="preview-tmpl">预览</button>
        </div>
      </div>
      <div class="card">
        <h2>系统提示词</h2>
        <p style="color:#666;font-size:13px;margin-bottom:8px;">LLM 生成交接文档时的系统提示词。可自定义角色和指令，影响所有交接生成的输出风格。</p>
        <div id="interview-start-wrap">
          <button class="btn btn-default" id="interview-start">通过对话生成提示词</button>
          <span style="color:#999;font-size:13px;margin-left:8px;">回答几个问题，自动生成适合你的提示词</span>
        </div>
        <div id="interview-section" style="display:none;">
          <div id="interview-chat" class="chat-container"></div>
          <div class="chat-input-bar">
            <input type="text" id="interview-input" class="chat-input" placeholder="输入你的回答...">
            <button class="btn btn-primary btn-sm" id="interview-send">发送</button>
            <button class="btn btn-success btn-sm" id="interview-apply" style="display:none;">采用此提示词</button>
            <button class="btn btn-default btn-sm" id="interview-cancel">结束对话</button>
          </div>
        </div>
        <div class="form-group"><label>系统提示词</label><textarea id="sp-content"></textarea></div>
        <div id="sp-error"></div>
        <div class="btn-group">
          <button class="btn btn-primary" id="save-sp">保存</button>
          <button class="btn btn-default" id="reset-sp">重置为默认</button>
        </div>
      </div>
      <div class="card" id="tmpl-preview" style="display:none;">
        <h3>预览效果</h3>
        <div id="tmpl-preview-content" style="white-space:pre-wrap;font-family:monospace;background:#f9f9f9;padding:12px;border-radius:4px;"></div>
      </div>`;

    document.getElementById('tmpl-channel').addEventListener('change', async (e) => {
      const d = await api.get(`/channels/${e.target.value}/template`);
      document.getElementById('tmpl-content').value = d.data?.template || '';
    });

    document.getElementById('save-tmpl').addEventListener('click', async () => {
      const ch = document.getElementById('tmpl-channel').value;
      const content = document.getElementById('tmpl-content').value;
      const btn = document.getElementById('save-tmpl');
      try {
        btn.disabled = true;
        await api.put(`/channels/${ch}/template`, { template: content });
        document.getElementById('tmpl-error').innerHTML = '<div class="success">模版已保存</div>';
      } catch (err) {
        document.getElementById('tmpl-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('reset-tmpl').addEventListener('click', async () => {
      const ch = document.getElementById('tmpl-channel').value;
      try {
        const d = await api.put(`/channels/${ch}/template/reset`, {});
        document.getElementById('tmpl-content').value = d.data?.template || '';
      } catch (err) {
        document.getElementById('tmpl-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });

    document.getElementById('preview-tmpl').addEventListener('click', () => {
      const content = document.getElementById('tmpl-content').value;
      const sampleData = { important: '（重要事项示例：302 房客人要求延迟退房）', normal: '（一般事项示例：今日早餐已备好）', follow_up: '（待跟进：3楼空调故障待修）', sender: '张三', receiver: '李四', date: new Date().toISOString().split('T')[0], channel: chList[0]?.name || '' };
      let preview = content;
      for (const [key, value] of Object.entries(sampleData)) {
        preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      document.getElementById('tmpl-preview-content').textContent = preview;
      document.getElementById('tmpl-preview').style.display = 'block';
    });

    // System prompt section
    const spData = await api.get(`/channels/${code}/system-prompt`);
    document.getElementById('sp-content').value = spData.data?.systemPrompt || '';

    // Interview state
    let interviewMessages = [];
    let interviewActive = false;

    function renderInterviewChat() {
      const container = document.getElementById('interview-chat');
      if (!container) return;
      container.innerHTML = interviewMessages.map(m =>
        m.role === 'assistant'
          ? `<div class="chat-msg assistant">${esc(m.content).replace(/\n/g, '<br>')}</div>`
          : `<div class="chat-msg user">${esc(m.content).replace(/\n/g, '<br>')}</div>`
      ).join('');
      container.scrollTop = container.scrollHeight;
    }

    async function sendInterviewMessage() {
      const input = document.getElementById('interview-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      interviewMessages.push({ role: 'user', content: text });
      renderInterviewChat();

      const sendBtn = document.getElementById('interview-send');
      sendBtn.disabled = true;
      sendBtn.textContent = '思考中...';

      try {
        const res = await api.post(`/channels/${document.getElementById('tmpl-channel').value}/system-prompt/interview`, {
          messages: interviewMessages,
        });
        interviewMessages.push({ role: 'assistant', content: res.data.reply });
        renderInterviewChat();

        if (res.data.proposedPrompt) {
          document.getElementById('interview-apply').style.display = 'inline-block';
          document.getElementById('interview-apply').dataset.prompt = res.data.proposedPrompt;
        }
      } catch (err) {
        interviewMessages.push({ role: 'assistant', content: `出错了: ${err.message}` });
        renderInterviewChat();
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
      }
    }

    function startInterview() {
      interviewActive = true;
      interviewMessages = [];
      document.getElementById('interview-section').style.display = 'block';
      document.getElementById('interview-start-wrap').style.display = 'none';
      // Kick off with an empty first message to get the initial question
      interviewMessages.push({ role: 'user', content: '开始' });
      renderInterviewChat();
      sendInterviewMessage();
    }

    document.getElementById('interview-start').addEventListener('click', startInterview);

    document.getElementById('interview-send').addEventListener('click', sendInterviewMessage);

    document.getElementById('interview-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendInterviewMessage();
      }
    });

    document.getElementById('interview-apply').addEventListener('click', () => {
      const prompt = document.getElementById('interview-apply').dataset.prompt;
      if (prompt) {
        document.getElementById('sp-content').value = prompt;
        document.getElementById('sp-content').scrollIntoView({ behavior: 'smooth' });
      }
    });

    document.getElementById('interview-cancel').addEventListener('click', () => {
      interviewActive = false;
      interviewMessages = [];
      document.getElementById('interview-section').style.display = 'none';
      document.getElementById('interview-start-wrap').style.display = 'block';
      document.getElementById('interview-apply').style.display = 'none';
    });

    document.getElementById('tmpl-channel').addEventListener('change', async (e) => {
      const d = await api.get(`/channels/${e.target.value}/system-prompt`);
      document.getElementById('sp-content').value = d.data?.systemPrompt || '';
      // Reset interview
      interviewActive = false;
      interviewMessages = [];
      document.getElementById('interview-section').style.display = 'none';
      document.getElementById('interview-start-wrap').style.display = 'block';
      document.getElementById('interview-apply').style.display = 'none';
    });

    document.getElementById('save-sp').addEventListener('click', async () => {
      const ch = document.getElementById('tmpl-channel').value;
      const content = document.getElementById('sp-content').value;
      const btn = document.getElementById('save-sp');
      try {
        btn.disabled = true;
        await api.put(`/channels/${ch}/system-prompt`, { systemPrompt: content });
        document.getElementById('sp-error').innerHTML = '<div class="success">系统提示词已保存</div>';
      } catch (err) {
        document.getElementById('sp-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('reset-sp').addEventListener('click', async () => {
      const ch = document.getElementById('tmpl-channel').value;
      try {
        const d = await api.put(`/channels/${ch}/system-prompt/reset`, {});
        document.getElementById('sp-content').value = d.data?.systemPrompt || '';
      } catch (err) {
        document.getElementById('sp-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });
  }

  // --- Handovers ---
  async function renderHandovers(page) {
    page = page || 1;
    const pageSize = 20;
    const data = await api.get(`/handovers?page=${page}&pageSize=${pageSize}`);
    const records = data.data?.records || [];
    const total = data.data?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    let rows = records.map(r => `
      <tr>
        <td>${esc(r.channel_name || r.channel_code || '')}</td>
        <td>${esc(r.sender_name || (r.sender && r.sender.name) || '')}</td>
        <td>${esc(r.receiver_name || (r.receiver && r.receiver.name) || '-')}</td>
        <td>${esc(r.created_at || '')}</td>
        <td><span class="badge ${r.status === 'completed' ? 'badge-success' : 'badge-warning'}">${r.status || ''}</span></td>
      </tr>`).join('');

    const prevBtn = page > 1 ? `<button class="btn btn-sm btn-default" onclick="renderHandovers(${page - 1})">上一页</button>` : '';
    const nextBtn = page < totalPages ? `<button class="btn btn-sm btn-primary" onclick="renderHandovers(${page + 1})">下一页</button>` : '';

    main.innerHTML = `
      <div class="card">
        <h2>交接记录查询</h2>
        <table><thead><tr><th>渠道</th><th>交班人</th><th>接班人</th><th>时间</th><th>状态</th></tr></thead><tbody>${rows || '<tr><td colspan="5">暂无记录</td></tr>'}</tbody></table>
        <div class="pagination">
          <span class="page-info">共 ${total} 条记录 · 第 ${page}/${totalPages} 页</span>
          ${prevBtn} ${nextBtn}
        </div>
      </div>`;
  }

  window.renderHandovers = renderHandovers;

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

  // --- Agent ---
  async function renderAgent() {
    const channels = await api.get('/channels');
    const chList = channels.data || [];
    if (chList.length === 0) {
      main.innerHTML = '<div class="card"><h2>Agent 设置</h2><p>请先添加渠道。</p></div>';
      return;
    }

    const code = chList[0].code;

    main.innerHTML = `
      <div class="card">
        <h2>Agent 人设 (Soul)</h2>
        <div class="form-group"><label>渠道</label><select id="agent-channel">${chList.map(ch => `<option value="${ch.code}">${ch.name} (${ch.code})</option>`).join('')}</select></div>
        <div class="form-group"><label>场景模板</label><select id="agent-template"><option value="">-- 选择内置模板 --</option></select></div>
        <div class="form-group"><label>人设描述</label><textarea id="agent-persona" rows="2" placeholder="如：你是一位专业的酒店前台交接班助手"></textarea></div>
        <div class="form-group"><label>语气风格</label><input id="agent-tone" placeholder="如：专业、细致"></div>
        <div class="form-group"><label>行为约束（每行一条）</label><textarea id="agent-constraints" rows="3" placeholder="关注客房状态&#10;关注宾客特殊需求"></textarea></div>
        <div class="form-group"><label>自定义场景描述</label><textarea id="agent-custom" rows="2" placeholder="仅在场景为自定义时使用"></textarea></div>
        <div id="agent-soul-error"></div>
        <div class="btn-group">
          <button class="btn btn-primary" id="save-soul">保存</button>
          <button class="btn btn-default" id="reset-soul">重置为默认</button>
        </div>
      </div>
      <div class="card">
        <h2>经验规则</h2>
        <p style="color:#666;font-size:13px;margin-bottom:8px;">Agent 从用户编辑行为中积累的经验，以及深度反思优化后的规则。</p>
        <div id="experience-list"></div>
        <div id="experience-error"></div>
      </div>
      <div class="card">
        <h2>深度反思 (Dream)</h2>
        <p style="color:#666;font-size:13px;margin-bottom:8px;">定期审视经验规则，提炼优化。也可手动触发。</p>
        <div class="form-group"><label>启用定时反思</label><select id="dream-enabled"><option value="true">是</option><option value="false">否</option></select></div>
        <div class="form-group"><label>反思时间（每天）</label><select id="dream-hour">${Array.from({length:24}, (_,i) => `<option value="${i}"${i===3?' selected':''}>${String(i).padStart(2,'0')}:00</option>`).join('')}</select></div>
        <div id="dream-info"></div>
        <div id="dream-error"></div>
        <div class="btn-group">
          <button class="btn btn-primary" id="save-dream">保存</button>
          <button class="btn btn-default" id="trigger-dream">立即反思</button>
        </div>
      </div>`;

    // Load templates
    const templatesData = await api.get(`/channels/${code}/agent/soul/templates`);
    const templates = templatesData.data?.templates || [];
    const tmplSelect = document.getElementById('agent-template');
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} - ${t.description}`;
      tmplSelect.appendChild(opt);
    });

    // Load current soul
    async function loadSoul(chCode) {
      const res = await api.get(`/channels/${chCode}/agent/soul`);
      const soul = res.data?.soul || {};
      document.getElementById('agent-persona').value = soul.persona || '';
      document.getElementById('agent-tone').value = soul.tone || '';
      document.getElementById('agent-constraints').value = (soul.constraints || []).join('\n');
      document.getElementById('agent-custom').value = soul.customScenario || '';
      document.getElementById('agent-template').value = soul.scenario || '';
    }

    // Load experience
    async function loadExperience(chCode) {
      const res = await api.get(`/channels/${chCode}/agent/experience`);
      const entries = res.data?.entries || [];
      const lastDreamAt = res.data?.lastDreamAt;
      const container = document.getElementById('experience-list');

      if (entries.length === 0) {
        container.innerHTML = '<p style="color:#999">暂无经验规则</p>';
      } else {
        container.innerHTML = `<table>
          <tr><th>规则</th><th>来源</th><th>时间</th><th>操作</th></tr>
          ${entries.map(e => `<tr>
            <td>${esc(e.rule)}</td>
            <td><span class="badge ${e.source === 'dream' ? 'badge-info' : 'badge-success'}">${e.source === 'dream' ? '反思' : '编辑'}</span></td>
            <td>${new Date(e.createdAt).toLocaleString()}</td>
            <td><button class="btn btn-danger btn-sm del-exp" data-id="${esc(e.id)}">删除</button></td>
          </tr>`).join('')}
        </table>`;
      }

      const dreamInfo = document.getElementById('dream-info');
      dreamInfo.innerHTML = lastDreamAt
        ? `<span class="badge badge-info">上次反思: ${new Date(lastDreamAt).toLocaleString()}</span>`
        : '<span class="badge badge-warning">尚未执行过反思</span>';
    }

    // Load dream config
    async function loadDreamConfig(chCode) {
      const res = await api.get(`/channels/${chCode}/agent/dream-config`);
      const config = res.data?.config || {};
      document.getElementById('dream-enabled').value = String(config.enabled ?? true);
      document.getElementById('dream-hour').value = String(config.cronHour ?? 3);
    }

    // Initial load
    await loadSoul(code);
    await loadExperience(code);
    await loadDreamConfig(code);

    // Channel switch
    document.getElementById('agent-channel').addEventListener('change', async (e) => {
      await loadSoul(e.target.value);
      await loadExperience(e.target.value);
      await loadDreamConfig(e.target.value);
    });

    // Template auto-fill
    document.getElementById('agent-template').addEventListener('change', (e) => {
      const tmpl = templates.find(t => t.id === e.target.value);
      if (tmpl) {
        document.getElementById('agent-persona').value = tmpl.soul.persona;
        document.getElementById('agent-tone').value = tmpl.soul.tone || '';
        document.getElementById('agent-constraints').value = (tmpl.soul.constraints || []).join('\n');
        document.getElementById('agent-custom').value = tmpl.soul.customScenario || '';
      }
    });

    // Save soul
    document.getElementById('save-soul').addEventListener('click', async () => {
      const ch = document.getElementById('agent-channel').value;
      const btn = document.getElementById('save-soul');
      try {
        btn.disabled = true;
        await api.put(`/channels/${ch}/agent/soul`, {
          persona: document.getElementById('agent-persona').value,
          tone: document.getElementById('agent-tone').value,
          constraints: document.getElementById('agent-constraints').value.split('\n').map(s => s.trim()).filter(Boolean),
          customScenario: document.getElementById('agent-custom').value,
          scenario: document.getElementById('agent-template').value || 'custom',
        });
        document.getElementById('agent-soul-error').innerHTML = '<div class="success">人设已保存</div>';
      } catch (err) {
        document.getElementById('agent-soul-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    });

    // Reset soul
    document.getElementById('reset-soul').addEventListener('click', async () => {
      const ch = document.getElementById('agent-channel').value;
      try {
        const res = await api.put(`/channels/${ch}/agent/soul/reset`, {});
        const soul = res.data?.soul || {};
        document.getElementById('agent-persona').value = soul.persona || '';
        document.getElementById('agent-tone').value = soul.tone || '';
        document.getElementById('agent-constraints').value = (soul.constraints || []).join('\n');
        document.getElementById('agent-custom').value = soul.customScenario || '';
        document.getElementById('agent-template').value = '';
      } catch (err) {
        document.getElementById('agent-soul-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });

    // Delete experience entry
    document.getElementById('experience-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('.del-exp');
      if (!btn) return;
      const ch = document.getElementById('agent-channel').value;
      try {
        await api.delete(`/channels/${ch}/agent/experience/${btn.dataset.id}`);
        await loadExperience(ch);
      } catch (err) {
        document.getElementById('experience-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });

    // Save dream config
    document.getElementById('save-dream').addEventListener('click', async () => {
      const ch = document.getElementById('agent-channel').value;
      const btn = document.getElementById('save-dream');
      try {
        btn.disabled = true;
        await api.put(`/channels/${ch}/agent/dream-config`, {
          enabled: document.getElementById('dream-enabled').value === 'true',
          cronHour: parseInt(document.getElementById('dream-hour').value, 10),
        });
        document.getElementById('dream-error').innerHTML = '<div class="success">反思配置已保存</div>';
      } catch (err) {
        document.getElementById('dream-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    });

    // Manual dream trigger
    document.getElementById('trigger-dream').addEventListener('click', async () => {
      const ch = document.getElementById('agent-channel').value;
      const btn = document.getElementById('trigger-dream');
      try {
        btn.disabled = true;
        btn.textContent = '反思中...';
        const res = await api.post(`/channels/${ch}/agent/dream/trigger`, {});
        const report = res.data?.report;
        if (report) {
          document.getElementById('dream-error').innerHTML = `<div class="success">反思完成: ${report.originalCount} 条规则优化为 ${report.optimizedCount} 条</div>`;
        } else {
          document.getElementById('dream-error').innerHTML = '<div class="success">没有经验规则可供反思</div>';
        }
        await loadExperience(ch);
      } catch (err) {
        document.getElementById('dream-error').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = '立即反思';
      }
    });
  }
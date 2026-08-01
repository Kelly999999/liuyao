/**
 * 六爻问卦 - 主应用逻辑
 */

// ===== AI 解卦配置 =====
// 生产环境（Vercel）：走后端代理 /api/interpret，Key 藏在服务器环境变量
// 本地开发（localhost / 127.0.0.1 / file://）：直连 DeepSeek，使用 localStorage 里的 Key
var IS_LOCAL_DEV = (function() {
  var h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '' || location.protocol === 'file:';
})();

var AI_ENDPOINT = '/api/interpret';
var DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
var LOCAL_KEY_STORAGE = 'liuyao_local_deepseek_key';

function getLocalDeepSeekKey() {
  try { return localStorage.getItem(LOCAL_KEY_STORAGE) || ''; } catch(e) { return ''; }
}
function setLocalDeepSeekKey(k) {
  try { localStorage.setItem(LOCAL_KEY_STORAGE, k); } catch(e) {}
}

// ===== 音效系统 =====
var SoundEngine = {
  ctx: null,
  enabled: true,
  // 铜钱共振频率（基于古铜钱物理特性）
  coinResonances: [2800, 4200, 5600, 7100],

  init: function() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) {
        this.enabled = false;
      }
    }
  },

  // 生成铜钱撞击的 buffer（预生成，避免每次创建）
  _coinBuffers: {},
  _getCoinBuffer: function(duration) {
    if (this._coinBuffers[duration]) return this._coinBuffers[duration];
    var ctx = this.ctx;
    var sr = ctx.sampleRate;
    var len = Math.floor(sr * duration);
    var buffer = ctx.createBuffer(1, len, sr);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) {
      // 白噪声 + 快速衰减
      var env = Math.exp(-i / (sr * 0.008));
      data[i] = (Math.random() * 2 - 1) * env;
    }
    this._coinBuffers[duration] = buffer;
    return buffer;
  },

  // 单次铜钱撞击 — 清脆金属声
  _playSingleCoin: function(time, volume) {
    var ctx = this.ctx;

    // 1. 撞击瞬间的宽带噪声（click）
    var noiseLen = 0.02;
    var noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * noiseLen), ctx.sampleRate);
    var noiseData = noiseBuf.getChannelData(0);
    for (var i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
    }
    var noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    var noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + noiseLen);
    var hiFilter = ctx.createBiquadFilter();
    hiFilter.type = 'highpass';
    hiFilter.frequency.value = 3000;
    noise.connect(hiFilter);
    hiFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);

    // 2. 铜钱固有频率共振（多个泛音）
    var resonances = this.coinResonances;
    for (var r = 0; r < resonances.length; r++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      // 每次频率略有随机偏移，模拟真实铜钱
      var freq = resonances[r] * (0.95 + Math.random() * 0.1);
      osc.frequency.setValueAtTime(freq, time);
      // 高频衰减快，低频衰减慢
      var decay = 0.05 + r * 0.04;
      gain.gain.setValueAtTime(volume * (0.15 - r * 0.025), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + decay + 0.01);
    }
  },

  // 柔和的正弦音（缓入缓出，无爆音）
  _playSoftTone: function(time, vol, freq, decay, type) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + decay + 0.02);
  },

  // 掷钱 — 清风竹叶：三次极轻的沙沙声 + 淡淡音调
  playCoinClash: function() {
    if (!this.enabled) return;
    this.init();
    var ctx = this.ctx;
    var now = ctx.currentTime;

    for (var i = 0; i < 3; i++) {
      var t = now + i * 0.06;
      // 竹叶摩擦的沙沙声（带通滤波的短噪声）
      var len = 0.08;
      var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var j = 0; j < d.length; j++) {
        d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.02));
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      var flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 3000;
      flt.Q.value = 2;
      src.connect(flt);
      flt.connect(g);
      g.connect(ctx.destination);
      src.start(t);

      // 极轻的音调点缀
      this._playSoftTone(t, 0.05, 1800 + i * 100, 0.1, 'sine');
    }
  },

  // 铜钱落定 — 清风竹叶：柔和的中高频音
  playCoinLand: function() {
    if (!this.enabled) return;
    this.init();
    var now = this.ctx.currentTime;
    this._playSoftTone(now, 0.12, 2000, 0.25, 'sine');
    this._playSoftTone(now, 0.05, 3500, 0.15, 'sine');
  },

  // 成卦完成 — 编钟/磬音
  playHexagramComplete: function() {
    if (!this.enabled) return;
    this.init();
    var ctx = this.ctx;
    var notes = [523, 659, 784, 1047, 1319];
    for (var i = 0; i < notes.length; i++) {
      var t = ctx.currentTime + i * 0.12;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.2);

      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(notes[i] * 2.76, t);
      gain2.gain.setValueAtTime(0.03, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t);
      osc2.stop(t + 0.6);
    }
  },

  // 按钮点击
  playClick: function() {
    if (!this.enabled) return;
    this.init();
    var ctx = this.ctx;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
};

// ===== 应用状态 =====
var state = {
  currentPage: 'landing',
  question: '',
  category: 'general',
  lines: [],
  currentLine: 0,
  hexagramResult: null,
  flipPhase: 'idle', // idle | throwing | showing
  currentCoins: [],
  history: [],
  reminderShown: false, // 默念提醒是否已显示
  aiInterpretation: null, // AI 生成的解读
  aiLoading: false, // AI 是否正在生成
};

var STORAGE_KEY = 'liuyao_history';

// ===== AI 解卦 =====

// 构建卦象描述文本
function buildHexagramDescription() {
  var result = state.hexagramResult;
  if (!result) return '';

  var hd = result.hexagramData;
  var desc = '卦名：' + hd.fullName + '\n';
  desc += '上卦：' + result.upperTrigram.nature + '（' + result.upperTrigram.name + '）\n';
  desc += '下卦：' + result.lowerTrigram.nature + '（' + result.lowerTrigram.name + '）\n';
  desc += '卦辞：' + hd.guaCi + '\n';

  if (result.changingLines.length > 0) {
    desc += '变卦：' + (result.changedHexagram ? result.changedHexagram.hexagramData.fullName : '无') + '\n';
    desc += '动爻位置：' + result.changingLines.map(function(i) { return LINE_POSITIONS[i]; }).join('、') + '\n';
  }

  desc += '整体运势：' + hd.fortune + '\n';
  if (hd.keywords && hd.keywords.length) {
    desc += '核心意象：' + hd.keywords.join('、') + '\n';
  }
  if (hd.overview) {
    desc += '卦象概述：' + hd.overview + '\n';
  }

  return desc;
}

// 调用后端 AI 解卦代理
function callAIInterpretation(callback) {
  state.aiLoading = true;
  var hexDesc = buildHexagramDescription();

  // 本地开发环境：直连 DeepSeek，用户输入 Key 保存在浏览器
  if (IS_LOCAL_DEV) {
    var localKey = getLocalDeepSeekKey();
    if (!localKey) {
      state.aiLoading = false;
      callback(null, 'no_local_key');
      return;
    }
    return callDeepSeekDirect(hexDesc, localKey, callback);
  }

  // 生产环境：走后端代理
  fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      question: state.question,
      category: state.category,
      hexagram: hexDesc
    })
  })
  .then(function(res) {
    return res.json().then(function(body) {
      return { status: res.status, ok: res.ok, body: body };
    });
  })
  .then(function(result) {
    state.aiLoading = false;
    if (!result.ok) {
      var msg = (result.body && result.body.error) || 'AI 服务暂时不可用';
      if (result.status === 429) return callback(null, 'rate_limit:' + msg);
      if (result.status === 403) return callback(null, 'forbidden:' + msg);
      return callback(null, 'server_error:' + msg);
    }
    if (result.body && result.body.text) {
      callback(result.body.text, null);
    } else {
      callback(null, 'parse_error');
    }
  })
  .catch(function(err) {
    state.aiLoading = false;
    callback(null, 'network_error: ' + err.message);
  });
}

// ===== 本地直连 DeepSeek（仅本地开发使用）=====
function callDeepSeekDirect(hexDesc, apiKey, callback) {
  var systemPrompt = '你是一位精通六爻卦象的国学顾问。你擅长用通俗易懂、温暖有力的语言为用户解读卦象。你的风格是：像一个有智慧、有阅历的朋友在和你深谈——既有洞察力，又有温度。你不说套话，不说空话，每一句都落在用户的具体处境上。';
  var categoryName = (QUESTION_CATEGORIES[state.category] || QUESTION_CATEGORIES.general).name;
  var userPrompt = '用户用六爻占了一卦，请你为他深度解读。\n\n' +
    '【用户的问题】\n' + state.question + '\n\n' +
    '【问题类别】\n' + categoryName + '\n\n' +
    '【卦象信息】\n' + hexDesc + '\n\n' +
    '请按以下结构生成解读，用加粗小标题分段：\n\n' +
    '第一个小标题「当前处境」：用2-3句点明卦象映射到用户现实中的状态。要具体到用户的问题场景。\n\n' +
    '第二个小标题（根据问题类型自拟）：这是分析的核心段落，4-6句。用比喻和意象来分析，围绕用户具体问题展开。\n\n' +
    '第三个小标题「建议与方向」：3-4句具体建议，落地可操作。\n\n' +
    '最后一个短段落：一句有力量的收尾。\n\n' +
    '要求：全文600-900字；用"你"对话；绝对不要用"本卦""变卦""动爻""爻辞""用神""世应""六亲""相害""相合"等术语；不做绝对判断；涉及健康提醒就医、涉及法律提醒咨询律师。';

  fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    })
  })
  .then(function(res) {
    return res.json().then(function(body) {
      return { status: res.status, ok: res.ok, body: body };
    });
  })
  .then(function(result) {
    state.aiLoading = false;
    if (!result.ok) {
      if (result.status === 401) return callback(null, 'invalid_local_key');
      if (result.status === 429) return callback(null, 'rate_limit:请求过于频繁，请稍后再试');
      return callback(null, 'server_error:DeepSeek 返回 ' + result.status);
    }
    var text = result.body && result.body.choices && result.body.choices[0] && result.body.choices[0].message && result.body.choices[0].message.content;
    if (text) callback(text, null);
    else callback(null, 'parse_error');
  })
  .catch(function(err) {
    state.aiLoading = false;
    callback(null, 'network_error: ' + err.message);
  });
}

// ===== 本地 Key 设置弹窗（仅本地开发环境使用）=====
function showLocalKeyModal() {
  var modal = document.getElementById('local-key-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'local-key-modal';
    modal.className = 'modal-overlay';
    modal.onclick = hideLocalKeyModal;
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div class="modal-content" onclick="event.stopPropagation()">' +
      '<h3 class="modal-title">本地开发 · 设置 DeepSeek Key</h3>' +
      '<div class="modal-body">' +
        '<p style="margin-bottom:0.75rem;font-size:0.85rem;color:rgba(44,24,16,0.7)">' +
          '你正在本地环境（localhost）访问，此时前端直接调用 DeepSeek API。<br>' +
          '<strong>Key 只保存在你的浏览器 localStorage 里</strong>，不会上传任何地方。' +
        '</p>' +
        '<p style="margin-bottom:0.5rem;font-size:0.85rem"><strong>获取 Key：</strong><a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--jade)">platform.deepseek.com/api_keys</a></p>' +
        '<input id="local-key-input" class="input-field" style="min-height:auto;height:42px;font-size:0.85rem;font-family:monospace" placeholder="sk-..." value="' + escapeHtml(getLocalDeepSeekKey()) + '">' +
      '</div>' +
      '<div class="modal-actions" style="display:flex;gap:0.75rem;justify-content:center">' +
        '<button class="btn btn-secondary" onclick="hideLocalKeyModal()">取消</button>' +
        '<button class="btn btn-primary" onclick="saveLocalKey()">保存</button>' +
      '</div>' +
    '</div>';
  modal.style.display = 'flex';
  setTimeout(function() {
    var i = document.getElementById('local-key-input');
    if (i) i.focus();
  }, 100);
}
function hideLocalKeyModal() {
  var m = document.getElementById('local-key-modal');
  if (m) m.style.display = 'none';
}
function saveLocalKey() {
  var i = document.getElementById('local-key-input');
  if (i && i.value.trim()) {
    setLocalDeepSeekKey(i.value.trim());
    hideLocalKeyModal();
    // 保存后自动重新触发 AI 解卦
    startAIInterpretation(true);
  }
}

// ===== 初始化 =====
(function init() {
  // 加载历史记录
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state.history = JSON.parse(saved);
  } catch (e) { /* ignore */ }

  updateHistoryNav();
  renderPage();
})();

// ===== 导航 =====
function navigateTo(page) {
  state.currentPage = page;
  renderPage();
  window.scrollTo(0, 0);
}

function showDisclaimer() {
  document.getElementById('disclaimer-modal').style.display = 'flex';
}

function hideDisclaimer() {
  document.getElementById('disclaimer-modal').style.display = 'none';
}

// ===== 禁忌类问题提示弹窗 =====
function showForbiddenModal(topic, message) {
  var modal = document.getElementById('forbidden-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'forbidden-modal';
    modal.className = 'modal-overlay';
    modal.onclick = hideForbiddenModal;
    document.body.appendChild(modal);
  }
  modal.innerHTML =
    '<div class="modal-content forbidden-modal" onclick="event.stopPropagation()">' +
      '<div class="forbidden-icon">⚠</div>' +
      '<h3 class="modal-title">此类问题不宜占卜</h3>' +
      '<div class="forbidden-topic-tag">禁忌类别：' + escapeHtml(topic || '') + '</div>' +
      '<div class="modal-body">' +
        '<p class="forbidden-message">' + escapeHtml(message || '') + '</p>' +
        '<div class="forbidden-guidance">' +
          '<p class="forbidden-guidance-title">◆ 六爻问卦的原则 ◆</p>' +
          '<p>· 只问自己的方向与选择，不测他人隐私</p>' +
          '<p>· 只问人事，不测生死、鬼神</p>' +
          '<p>· 只求心之明镜，不涉政治、投机</p>' +
          '<p>· 卦以正问，方能得正应</p>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-primary" onclick="hideForbiddenModal()">我明白了</button>' +
      '</div>' +
    '</div>';
  modal.style.display = 'flex';
}

function hideForbiddenModal() {
  var modal = document.getElementById('forbidden-modal');
  if (modal) modal.style.display = 'none';
}

function updateHistoryNav() {
  var nav = document.getElementById('nav-history');
  if (state.history.length > 0) {
    nav.style.display = 'inline';
    nav.textContent = '占卜记录 (' + state.history.length + ')';
  } else {
    nav.style.display = 'none';
  }
  var footer = document.getElementById('footer');
  footer.style.display = state.currentPage === 'landing' ? 'none' : 'block';
}

// ===== 页面路由 =====
function renderPage() {
  var app = document.getElementById('app');
  updateHistoryNav();

  switch (state.currentPage) {
    case 'landing':     renderLanding(app); break;
    case 'question':    renderQuestionForm(app); break;
    case 'flipping':    renderFlipping(app); break;
    case 'result':      renderResult(app); break;
    case 'ai-loading':  renderAILoading(app); break;
    case 'ai-result':   renderAIResult(app); break;
    case 'interpretation': renderInterpretation(app); break;
    case 'donation':    renderDonation(app); break;
    case 'history':     renderHistory(app); break;
    default:            renderLanding(app);
  }
}

// ===== 首页 =====
function renderLanding(container) {
  container.innerHTML =
    '<div class="landing">' +
      '<section class="hero">' +
        '<div class="hero-deco">' +
          '<div class="blob-1"></div>' +
          '<div class="blob-2"></div>' +
          '<div class="blob-3"></div>' +
        '</div>' +
        '<div class="hero-content">' +
          '<div class="hero-symbols">' +
            '<span>☰</span><span>☷</span><span>☲</span><span>☵</span>' +
          '</div>' +
          '<h1 class="hero-title section-title">六爻问卦</h1>' +
          '<p class="hero-subtitle">模拟古法掷钱成卦 · 解读周易智慧</p>' +
          '<p class="hero-desc">以三枚铜钱掷六爻，成卦解象，为心中疑惑寻找方向</p>' +
          '<div class="hero-buttons">' +
            '<button class="btn btn-primary btn-primary-lg" onclick="navigateTo(\'question\')">开始占卦</button>' +
            (state.history.length > 0 ? '<button class="btn btn-secondary" onclick="navigateTo(\'history\')">查看历史记录</button>' : '') +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="landing-section alt-bg">' +
        '<div class="section-inner">' +
          '<div class="section-heading"><h2>何为六爻</h2></div>' +
          '<div class="features-grid">' +
            '<div>' +
              '<div class="feature-icon">🪙</div>' +
              '<div class="feature-title">掷钱成卦</div>' +
              '<p class="feature-desc">三枚铜钱合于掌心<br>抛掷六次，每次得一爻<br>六爻成卦</p>' +
            '</div>' +
            '<div>' +
              '<div class="feature-icon">☰</div>' +
              '<div class="feature-title">卦象解析</div>' +
              '<p class="feature-desc">结合本卦、变卦<br>解读当下时势与变化之道</p>' +
            '</div>' +
            '<div>' +
              '<div class="feature-icon">💡</div>' +
              '<div class="feature-title">智慧指引</div>' +
              '<p class="feature-desc">从古老智慧中获得启示<br>为心中困惑提供参考</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="landing-section">' +
        '<div class="section-inner">' +
          '<div class="section-heading"><h2>可以问什么</h2></div>' +
          '<div class="category-grid" id="category-grid">' +
            (function() {
              var catData = [
                ['career','💼','事业','工作变动、职业发展',
                  ['我最近该不该换工作？','公司可能要裁员，我会受影响吗？','我适合创业还是继续打工？','今年有升职的机会吗？','和领导关系不太好怎么办？']],
                ['love','💕','感情','姻缘、恋爱、婚姻',
                  ['我和对方还有发展的可能吗？','我和现在的伴侣合适吗？','我什么时候能遇到正缘？','分手后还能复合吗？','这段感情该继续还是放弃？']],
                ['wealth','💰','财运','投资理财、收入',
                  ['今年适合做投资吗？','我应该买房还是继续租房？','最近有一笔钱该怎么打理？','我适合做副业增加收入吗？','和朋友合伙做生意靠谱吗？']],
                ['study','📚','学业','考试、升学、进修',
                  ['这次考试我能顺利通过吗？','我应该考研还是直接工作？','出国留学对我发展有利吗？','我适合学什么专业方向？','考公务员对我来说是好选择吗？']],
                ['decision','🧭','抉择','面临选择、方向',
                  ['我应该留在大城市还是回老家？','面对两个offer该怎么选？','人生走到十字路口，该怎么抉择？','我应该坚持还是放弃？']],
                ['health','🌿','健康','养生、身体状态',
                  ['最近总是失眠该怎么办？','我该怎么调理身体状态？','工作压力大如何保持健康？','适合做什么运动来养生？']]
              ];
              return catData.map(function(cat) {
                var key = cat[0], icon = cat[1], name = cat[2], desc = cat[3], examples = cat[4];
                return '<div class="category-card-interactive" onclick="toggleCategory(this)">' +
                  '<div class="cat-card-top">' +
                    '<div class="category-icon">' + icon + '</div>' +
                    '<div class="category-name">' + name + '</div>' +
                    '<div class="category-desc">' + desc + '</div>' +
                    '<div class="cat-expand-hint">点击选择问题 ↓</div>' +
                  '</div>' +
                  '<div class="cat-examples">' +
                    examples.map(function(ex) {
                      return '<button class="cat-example-btn" onclick="event.stopPropagation(); pickQuestion(\'' + key + '\',\'' + escapeForAttr(ex) + '\')">' + ex + '</button>';
                    }).join('') +
                  '</div>' +
                '</div>';
              }).join('');
            })() +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="notice-section">' +
        '<div style="max-width:600px;margin:0 auto">' +
          '<h3 class="notice-title">问卦须知</h3>' +
          '<ul class="notice-list">' +
            '<li>🔸 一事一问，心诚则灵。请勿同时问多件事</li>' +
            '<li>🔸 问题要具体明确，避免过于宽泛</li>' +
            '<li>🔸 同一件事短期内不宜反复占问</li>' +
            '<li>🔸 占卜结果仅供参考娱乐，不可迷信依赖</li>' +
          '</ul>' +

          '<div class="forbidden-notice">' +
            '<p class="forbidden-notice-title">⚠ 卦有所不问 ⚠</p>' +
            '<div class="forbidden-notice-grid">' +
              '<span>· 不测政治</span>' +
              '<span>· 不测生死</span>' +
              '<span>· 不测他人隐私</span>' +
              '<span>· 不测胎儿性别</span>' +
              '<span>· 不涉股票理财</span>' +
              '<span>· 不涉赌博博彩</span>' +
              '<span>· 不涉鬼神灵异</span>' +
              '<span>· 不涉违法伤人</span>' +
            '</div>' +
            '<p class="forbidden-notice-hint">卦以正问，方能得正应。请以自身处境与选择为核心。</p>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<footer style="padding:2rem;text-align:center">' +
        '<div class="divider" style="max-width:12rem;margin:0 auto 1rem"><span style="font-size:0.7rem">✦</span></div>' +
        '<p style="font-size:0.75rem;color:rgba(44,24,16,0.3)">本站基于周易六爻文化 · 仅供娱乐与学习交流</p>' +
      '</footer>' +
    '</div>';
}

// ===== 问题输入页 =====
function renderQuestionForm(container) {
  var cats = Object.keys(QUESTION_CATEGORIES);
  var pillsHtml = cats.map(function(key) {
    var cat = QUESTION_CATEGORIES[key];
    var active = state.category === key ? ' active' : '';
    return '<button class="pill' + active + '" onclick="selectCategory(\'' + key + '\')">' +
      cat.icon + ' ' + cat.name + '</button>';
  }).join('');

  container.innerHTML =
    '<div class="question-page">' +
      '<div class="question-form">' +
        '<div class="form-header">' +
          '<h2 class="section-title">请心中默念所问之事</h2>' +
          '<p>静下心来，将您的疑惑详细描述</p>' +
        '</div>' +
        '<div class="card" style="margin-bottom:1.5rem">' +
          '<label class="form-label">您的问题</label>' +
          '<textarea id="question-input" class="input-field" placeholder="例如：我应该接受这个新的工作机会吗？" maxlength="200" oninput="onQuestionInput()">' + escapeHtml(state.question) + '</textarea>' +
          '<div class="form-meta">' +
            '<span id="question-error" class="form-error"></span>' +
            '<span id="question-counter" class="form-counter">' + state.question.length + '/200</span>' +
          '</div>' +
        '</div>' +
        '<div class="card" style="margin-bottom:2rem">' +
          '<label class="form-label">问题类别 <span class="form-label-hint">（可选，系统会自动识别）</span></label>' +
          '<div class="category-pills">' + pillsHtml + '</div>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'landing\')">返回</button>' +
          '<button class="btn btn-primary" onclick="submitQuestion()">开始掷卦</button>' +
        '</div>' +
        '<p class="form-footer-note">✦ 请确保问题是具体的、一件事 ✦</p>' +
      '</div>' +
    '</div>';

  // 自动聚焦
  setTimeout(function() {
    var input = document.getElementById('question-input');
    if (input) input.focus();
  }, 100);
}

function selectCategory(cat) {
  state.category = state.category === cat ? '' : cat;
  renderQuestionForm(document.getElementById('app'));
  // 恢复焦点
  setTimeout(function() {
    var input = document.getElementById('question-input');
    if (input) input.focus();
  }, 50);
}

function onQuestionInput() {
  var input = document.getElementById('question-input');
  if (!input) return;
  state.question = input.value;
  document.getElementById('question-counter').textContent = input.value.length + '/200';
  document.getElementById('question-error').textContent = '';
  input.classList.remove('error');

  // 自动推断类别
  if (input.value.length > 3 && !state.category) {
    var inferred = inferCategory(input.value);
    if (inferred !== 'general') {
      state.category = inferred;
      // 更新pill样式
      var pills = document.querySelectorAll('.pill');
      pills.forEach(function(p) { p.classList.remove('active'); });
    }
  }
}

function submitQuestion() {
  var q = state.question.trim();
  var validation = validateQuestion(q);
  if (!validation.valid) {
    if (validation.forbidden) {
      showForbiddenModal(validation.topic, validation.message);
    } else {
      document.getElementById('question-error').textContent = validation.message;
      document.getElementById('question-input').classList.add('error');
    }
    return;
  }
  state.question = q;
  if (!state.category) state.category = inferCategory(q);

  // 重置掷卦状态
  state.lines = [];
  state.currentLine = 0;
  state.hexagramResult = null;
  state.flipPhase = 'idle';
  state.currentCoins = [];
  state.aiInterpretation = null;
  state.aiInterpretationHexId = null;
  state.aiError = null;

  state.currentPage = 'flipping';
  renderPage();
}

// ===== 掷卦页 =====
function renderFlipping(container) {
  var catInfo = QUESTION_CATEGORIES[state.category] || QUESTION_CATEGORIES.general;

  // 进度条
  var progressHtml = '';
  for (var i = 0; i < 6; i++) {
    var cls = i < state.lines.length ? 'done' : (i === state.lines.length ? 'current' : 'pending');
    progressHtml += '<div class="progress-dot ' + cls + '"></div>';
  }

  // 已完成的爻线
  var linesHtml = '';
  for (var j = 0; j < state.lines.length; j++) {
    var line = state.lines[j];
    linesHtml += renderHexLineRow(j, line);
  }

  // 当前爻位占位
  if (state.lines.length < 6) {
    linesHtml += '<div class="hex-line-row">' +
      '<span class="hex-line-pos active">' + LINE_POSITIONS[state.lines.length] + '</span>' +
      '<div class="hex-line-placeholder"></div>' +
    '</div>';
  }

  // 铜钱区域
  var coinsHtml = '';
  if (state.flipPhase === 'throwing') {
    coinsHtml = '<div class="coins-container">';
    for (var k = 0; k < 3; k++) {
      coinsHtml += '<div class="coin flipping">' +
        '<div class="coin-inner">' +
          '<div class="coin-face coin-front"><span class="coin-front-text">✿</span></div>' +
        '</div>' +
      '</div>';
    }
    coinsHtml += '</div>';
  } else if (state.flipPhase === 'showing') {
    coinsHtml = '<div class="coins-container">';
    state.currentCoins.forEach(function(coin) {
      var rotation = coin === 3 ? 0 : 180;
      coinsHtml += '<div class="coin" style="transform:rotateY(' + rotation + 'deg)">' +
        '<div class="coin-inner">' +
          '<div class="coin-face coin-front"><span class="coin-front-text">✿</span></div>' +
          '<div class="coin-face coin-back"><span class="coin-back-text">✦</span></div>' +
        '</div>' +
      '</div>';
    });
    coinsHtml += '</div>';
  } else if (state.lines.length < 6) {
    // 空闲状态：展示三枚静态铜钱 + 爻位提示
    coinsHtml =
      '<div class="idle-coins-wrap">' +
        '<div class="coins-container idle">';
    for (var i = 0; i < 3; i++) {
      coinsHtml += '<div class="coin idle-coin">' +
        '<div class="coin-inner">' +
          '<div class="coin-face coin-front"><span class="coin-front-text">✿</span></div>' +
        '</div>' +
      '</div>';
    }
    coinsHtml +=
        '</div>' +
        '<p class="coin-idle-hint-text">第 ' + (state.lines.length + 1) + ' 爻 · ' + LINE_POSITIONS[state.lines.length] + '</p>' +
      '</div>';
  }

  // 爻信息
  var lineInfoHtml = '';
  if (state.flipPhase === 'showing' && state.lines.length > 0) {
    var lastLine = state.lines[state.lines.length - 1];
    var lt = LINE_TYPES[lastLine.lineType];
    var tagClass = lastLine.isChanging ? 'changing' : 'normal';
    lineInfoHtml = '<div class="line-info-badge">' +
      '<span class="line-info-tag ' + tagClass + '">' + lt.label +
      (lastLine.isChanging ? ' · 动爻' : '') + '</span></div>';
  }

  // 操作按钮（统一大小和位置，避免每次跳动）
  var actionsHtml = '';
  if (state.flipPhase === 'idle' && state.lines.length < 6) {
    actionsHtml = '<button class="btn btn-primary btn-flip" onclick="doThrow()">🪙 掷钱</button>';
  } else if (state.flipPhase === 'showing') {
    var btnText = state.lines.length >= 6 ? '✨ 成卦' : '继续掷下一爻';
    actionsHtml = '<button class="btn btn-primary btn-flip" onclick="confirmLine()">' + btnText + '</button>';
  } else {
    // throwing 阶段：占位一个不可点的按钮，保持布局稳定
    actionsHtml = '<button class="btn btn-primary btn-flip" disabled>🪙 掷钱中...</button>';
  }

  // 默念提醒（未完成六爻时常驻显示）
  var reminderHtml = '';
  if (state.lines.length < 6) {
    var tips = [
      '掷卦前，请深呼吸三次，在心中默念您的问题<br>摒除杂念，心诚则灵',
      '保持专注，继续默念您的问题',
      '心无旁骛，意念集中于所问之事',
      '气定神闲，让铜钱感应您的心念',
      '心诚则灵，每一次掷钱都是与卦象的对话',
      '最后一爻了，请更加专注'
    ];
    reminderHtml = '<div class="flip-reminder">🔔 ' + tips[Math.min(state.lines.length, tips.length - 1)] + '</div>';
  }

  // 音效开关
  var soundToggleHtml = '<button class="sound-toggle" onclick="toggleSound()" title="音效开关">' +
    (SoundEngine.enabled ? '🔊' : '🔇') + '</button>';

  container.innerHTML =
    '<div class="flipping-page">' +
      soundToggleHtml +
      '<div class="flipping-question">' +
        '<div class="flipping-category-tag">' + catInfo.icon + ' ' + catInfo.name + '</div>' +
        '<p class="flipping-question-text">' + escapeHtml(state.question) + '</p>' +
      '</div>' +
      reminderHtml +
      '<div class="flip-progress">' + progressHtml + '</div>' +
      '<div class="hexagram-build">' + linesHtml + '</div>' +
      '<div class="coins-area">' + coinsHtml + '</div>' +
      lineInfoHtml +
      '<div class="flip-actions">' + actionsHtml + '</div>' +
      '<p class="flip-note">每次掷出三枚铜钱，三枚的合计决定爻的属性。<br>合计 6（老阴）、7（少阳）、8（少阴）、9（老阳）</p>' +
    '</div>';
}

function renderHexLineRow(idx, line) {
  var posLabel = LINE_POSITIONS[idx];
  var lineHtml;
  if (line.isYang) {
    var cls = line.isChanging ? 'hex-line yang changing-line' : 'hex-line yang';
    lineHtml = '<div class="' + cls + '"></div>';
  } else {
    var yinCls = line.isChanging ? 'changing-line' : '';
    lineHtml = '<div class="hex-line yin">' +
      '<div class="yin-half ' + yinCls + '"></div>' +
      '<div class="yin-half ' + yinCls + '"></div>' +
    '</div>';
  }
  var changingLabel = line.isChanging ? '<span class="hex-changing-label">变</span>' : '';
  return '<div class="hex-line-row">' +
    '<span class="hex-line-pos">' + posLabel + '</span>' +
    lineHtml + changingLabel +
  '</div>';
}

function doThrow() {
  if (state.flipPhase !== 'idle' || state.lines.length >= 6) return;

  SoundEngine.playCoinClash();
  state.flipPhase = 'throwing';
  state.currentCoins = [];
  renderFlipping(document.getElementById('app'));

  setTimeout(function() {
    var result = throwCoins();
    state.currentCoins = result.coins;
    state.lines.push(result);
    state.flipPhase = 'showing';
    SoundEngine.playCoinLand();
    renderFlipping(document.getElementById('app'));
  }, 900);
}

function confirmLine() {
  if (state.lines.length >= 6) {
    SoundEngine.playHexagramComplete();
    // 六爻完成，计算卦象
    state.hexagramResult = calculateHexagram(state.lines);

    // 保存到历史
    var record = {
      id: Date.now(),
      question: state.question,
      category: state.category,
      date: new Date().toISOString(),
      hexagramName: state.hexagramResult.hexagramData ? state.hexagramResult.hexagramData.fullName : '未知卦',
      hexagramNumber: state.hexagramResult.hexagramData ? state.hexagramResult.hexagramData.number : 0,
      fortune: state.hexagramResult.hexagramData ? state.hexagramResult.hexagramData.fortune : '',
      changingLines: state.hexagramResult.changingLines.length,
      changedHexagram: state.hexagramResult.changedHexagram && state.hexagramResult.changedHexagram.hexagramData
        ? state.hexagramResult.changedHexagram.hexagramData.fullName : '',
      // 保存完整的爻数据以便回顾
      lines: state.lines.map(function(l) {
        return { lineType: l.lineType, isYang: l.isYang, isChanging: l.isChanging };
      }),
      aiInterpretation: null, // AI 解读结果（生成后写入）
    };
    state.currentRecordId = record.id; // 记住当前记录 id，用于 AI 生成后更新
    state.history.unshift(record);
    if (state.history.length > 20) state.history = state.history.slice(0, 20);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history)); } catch (e) {}
    updateHistoryNav();

    state.currentPage = 'result';
    renderPage();
  } else {
    state.flipPhase = 'idle';
    state.currentCoins = [];
    renderFlipping(document.getElementById('app'));
  }
}

// ===== 结果页 =====
function renderResult(container) {
  var result = state.hexagramResult;
  if (!result || !result.hexagramData) {
    container.innerHTML = '<div style="text-align:center;padding:4rem"><p>卦象数据异常，请重新占卦</p>' +
      '<button class="btn btn-primary" onclick="navigateTo(\'landing\')" style="margin-top:1rem">返回首页</button></div>';
    return;
  }

  var hd = result.hexagramData;

  // 本卦线条（从上到下显示）
  var mainLinesHtml = renderHexagramLinesDisplay(result.lines, false, result.changingLines);
  // 变卦线条
  var changedLinesHtml = '';
  if (result.changedHexagram) {
    changedLinesHtml = renderHexagramLinesDisplay(result.changedHexagram.lines, true, []);
  }

  var changingCount = result.changingLines.length;

  container.innerHTML =
    '<div class="result-page">' +
      '<div class="result-inner">' +
        '<div class="result-header">' +
          '<p class="result-header-label">您占得</p>' +
          '<h2 class="result-hexagram-name section-title">' + escapeHtml(hd.fullName) + '</h2>' +
          '<div class="result-trigram-info">' +
            '<span>上' + result.upperTrigram.nature + result.upperTrigram.symbol + ' ' + result.upperTrigram.name + '</span>' +
            '<span class="result-trigram-dot">·</span>' +
            '<span>下' + result.lowerTrigram.nature + result.lowerTrigram.symbol + ' ' + result.lowerTrigram.name + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="hexagram-display-row">' +
          '<div class="hexagram-column">' +
            '<p class="hexagram-column-label">本卦</p>' +
            '<div class="card hexagram-box">' +
              '<div class="hexagram-lines">' + mainLinesHtml + '</div>' +
              '<p class="hexagram-box-name">' + escapeHtml(hd.name) + '</p>' +
              '<p class="hexagram-box-sub">' + escapeHtml(hd.fullName) + '</p>' +
            '</div>' +
          '</div>' +
          (result.changedHexagram ?
            '<div class="hexagram-column">' +
              '<p class="hexagram-column-label">变卦</p>' +
              '<div class="card hexagram-box changed">' +
                '<div class="hexagram-lines">' + changedLinesHtml + '</div>' +
                '<p class="hexagram-box-name">' + escapeHtml(result.changedHexagram.hexagramData.name) + '</p>' +
                '<p class="hexagram-box-sub">' + escapeHtml(result.changedHexagram.hexagramData.fullName) + '</p>' +
              '</div>' +
            '</div>' : ''
          ) +
        '</div>' +

        '<div class="card guaci-card">' +
          '<div class="guaci-label"><span class="ornament-marker">◆</span><span>卦辞</span></div>' +
          '<p class="guaci-text">「' + escapeHtml(hd.guaCi) + '」</p>' +
          (hd.summary ? '<p class="guaci-summary">' + escapeHtml(hd.summary) + '</p>' : '') +
        '</div>' +

        '<div class="info-stats">' +
          '<div class="card stat-card"><p class="stat-label">运势</p><p class="stat-value">' + escapeHtml(hd.fortune) + '</p></div>' +
          '<div class="card stat-card"><p class="stat-label">动爻</p><p class="stat-value">' + changingCount + ' 个</p></div>' +
          '<div class="card stat-card"><p class="stat-label">意象</p><p class="stat-value">' + escapeHtml(hd.imagery || '—') + '</p></div>' +
        '</div>' +

        '<div class="question-recall">' +
          '<p class="question-recall-label">所问之事</p>' +
          '<p class="question-recall-text">' + escapeHtml(state.question) + '</p>' +
        '</div>' +

        '<div class="result-actions">' +
          '<button class="btn btn-secondary" onclick="restart()">重新占卦</button>' +
          '<button class="btn btn-primary" onclick="startAIInterpretation()">AI 智能解卦</button>' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'interpretation\')">查看基础解读</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderHexagramLinesDisplay(lines, isChanged, changingPositions) {
  var html = '';
  // 从上到下显示（上爻在顶部）
  for (var i = lines.length - 1; i >= 0; i--) {
    var line = lines[i];
    var isChanging = changingPositions.indexOf(i) !== -1;
    if (line.isYang) {
      var cls = isChanged ? 'h-line yang changed' : 'h-line yang';
      if (isChanging) cls += ' changing-mark';
      html += '<div class="' + cls + '"></div>';
    } else {
      var yinCls = isChanged ? 'changed' : '';
      html += '<div class="h-line yin">' +
        '<div class="yin-half ' + yinCls + '"></div>' +
        '<div class="yin-half ' + yinCls + '"></div>' +
      '</div>';
    }
  }
  return html;
}

// ===== AI 解卦加载页 =====
function startAIInterpretation(forceRegenerate) {
  // 已有缓存的 AI 解读且卦象未变（同一次占卦），直接展示
  if (!forceRegenerate && state.aiInterpretation && state.aiInterpretationHexId === (state.hexagramResult && state.hexagramResult.hexagramData && state.hexagramResult.hexagramData.number)) {
    state.currentPage = 'ai-result';
    state.aiError = null;
    renderPage();
    window.scrollTo(0, 0);
    return;
  }

  state.aiLoading = true;
  state.aiInterpretation = null;
  state.aiError = null;
  state.currentPage = 'ai-loading';
  renderPage();
  window.scrollTo(0, 0);

  callAIInterpretation(function(text, error) {
    if (error) {
      state.aiLoading = false;
      state.aiError = error;
      state.currentPage = 'ai-result';
      renderPage();
    } else {
      state.aiInterpretation = text;
      // 记录当前卦象 ID，用于判断是否是同一卦
      state.aiInterpretationHexId = state.hexagramResult && state.hexagramResult.hexagramData && state.hexagramResult.hexagramData.number;
      state.aiLoading = false;
      state.currentPage = 'ai-result';

      // 把 AI 解读写回对应的历史记录，下次点击历史直接展示，避免重复调用
      if (state.currentRecordId) {
        var idx = -1;
        for (var i = 0; i < state.history.length; i++) {
          if (state.history[i].id === state.currentRecordId) { idx = i; break; }
        }
        if (idx >= 0) {
          state.history[idx].aiInterpretation = text;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history)); } catch (e) {}
        }
      }

      renderPage();
      window.scrollTo(0, 0);
    }
  });
}

function renderAILoading(container) {
  var messages = [
    '正在感应卦象...',
    '翻阅古籍中...',
    '解读卦象含义...',
    '结合你的问题...',
    '即将为你呈现...'
  ];
  var msg = messages[Math.floor(Math.random() * messages.length)];

  container.innerHTML =
    '<div class="ai-loading-page">' +
      '<div class="ai-loading-inner">' +
        '<div class="ai-loading-hexagram">䷀</div>' +
        '<div class="ai-loading-spinner"></div>' +
        '<h2 class="ai-loading-title">AI 正在为你解卦</h2>' +
        '<p class="ai-loading-msg">' + msg + '</p>' +
        '<div class="ai-loading-question-card">' +
          '<p class="ai-loading-q-label">所问之事</p>' +
          '<p class="ai-loading-q-text">' + escapeHtml(state.question) + '</p>' +
        '</div>' +
        '<p class="ai-loading-hint">通常需要 5-10 秒</p>' +
        '<button class="btn btn-secondary" onclick="navigateTo(\'result\')" style="margin-top:1.5rem">返回</button>' +
      '</div>' +
    '</div>';
}

// ===== AI 解卦结果页 =====
function renderAIResult(container) {
  // 显示错误
  if (state.aiError) {
    var errorMsg = '';
    var err = state.aiError || '';
    var needsKey = false;

    if (err === 'no_local_key') {
      errorMsg = '本地开发模式下需要先设置 DeepSeek API Key';
      needsKey = true;
    } else if (err === 'invalid_local_key') {
      errorMsg = 'DeepSeek API Key 无效，请重新设置';
      needsKey = true;
    } else if (err.indexOf('rate_limit:') === 0) errorMsg = err.substring(11);
    else if (err.indexOf('forbidden:') === 0) errorMsg = err.substring(10);
    else if (err.indexOf('server_error:') === 0) errorMsg = err.substring(13);
    else if (err.indexOf('network_error') === 0) errorMsg = '网络连接异常，请检查网络';
    else if (err === 'parse_error') errorMsg = 'AI 返回内容格式异常';
    else errorMsg = '生成失败，请稍后重试';

    var buttons = '<button class="btn btn-secondary" onclick="navigateTo(\'result\')">返回卦象</button>';
    if (needsKey) {
      buttons += '<button class="btn btn-primary" onclick="showLocalKeyModal()">设置 Key</button>';
    } else {
      buttons += '<button class="btn btn-primary" onclick="startAIInterpretation(true)">重试</button>';
    }
    buttons += '<button class="btn btn-secondary" onclick="navigateTo(\'interpretation\')">查看基础解读</button>';

    container.innerHTML =
      '<div class="ai-loading-page">' +
        '<div class="ai-loading-inner">' +
          '<div style="font-size:2.5rem;margin-bottom:1rem">' + (needsKey ? '🔑' : '😔') + '</div>' +
          '<h2 class="ai-loading-title">' + (needsKey ? '需要 API Key' : 'AI 解卦失败') + '</h2>' +
          '<p style="color:var(--cinnabar);margin-bottom:1.5rem">' + escapeHtml(errorMsg) + '</p>' +
          (needsKey ? '<p style="font-size:0.85rem;color:rgba(44,24,16,0.5);margin-bottom:1.5rem;line-height:1.7">你正在 localhost 访问，需要提供 DeepSeek Key。<br>Key 仅存于浏览器，部署到线上后不需要此操作。</p>' : '') +
          '<div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">' +
            buttons +
          '</div>' +
        '</div>' +
      '</div>';
    return;
  }

  var text = state.aiInterpretation;
  if (!text) {
    container.innerHTML = '<div style="text-align:center;padding:4rem"><p>解读生成失败</p>' +
      '<button class="btn btn-primary" onclick="navigateTo(\'result\')" style="margin-top:1rem">返回</button></div>';
    return;
  }

  // 将 markdown 风格的文本转为 HTML
  var htmlText = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="ai-text-para">')
    .replace(/\n/g, '<br>');

  container.innerHTML =
    '<div class="interp-page">' +
      '<div class="interp-inner">' +
        '<div class="interp-header">' +
          '<div class="interp-tag"> AI 智能解卦</div>' +
          '<h2 class="section-title">解卦结果</h2>' +
        '</div>' +

        '<div class="card question-card" style="margin-bottom:1.5rem">' +
          '<p class="question-card-label">你的问题</p>' +
          '<p class="question-card-text">' + escapeHtml(state.question) + '</p>' +
        '</div>' +

        '<div class="card ai-interpretation-card">' +
          '<div class="ai-text-content"><p class="ai-text-para">' + htmlText + '</p></div>' +
        '</div>' +

        '<div class="interp-disclaimer">' +
          '<div class="divider"><span style="font-size:0.7rem">✦</span></div>' +
          '<p>以上解读由 AI 基于周易卦象生成，仅供参考与学习交流。<br>人生的方向始终掌握在自己手中。<br>如遇重大决策，请结合实际情况理性判断。</p>' +
        '</div>' +

        '<div class="guajin-hint">' +
          '<p class="guajin-hint-title">◆ 卦金之礼 ◆</p>' +
          '<p class="guajin-hint-text">古人云「卜筮不问未诚之人，卦金不受不诚之心」。<br>若此卦解读于你有所启发，不妨奉上一份卦金，以谢天地卦象之应、以敬心中所问之郑重。</p>' +
          '<button class="btn btn-primary guajin-cta" onclick="navigateTo(\'donation\')">✦ 奉上卦金 ✦</button>' +
        '</div>' +

        '<div class="interp-actions">' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'result\')">返回卦象</button>' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'interpretation\')">查看基础解读</button>' +
          '<button class="btn btn-primary" onclick="navigateTo(\'donation\')">赏卦金</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ===== API Key 设置弹窗（已废弃，使用后端 DeepSeek Key）=====
// 保留空实现以兼容旧调用（不再使用）
function showApiKeyModal() {}
function hideApiKeyModal() {}
function saveApiKey() {}

// ===== 解卦页 =====
function renderInterpretation(container) {
  var result = state.hexagramResult;
  if (!result || !result.hexagramData) {
    container.innerHTML = '<div style="text-align:center;padding:4rem"><p>数据异常</p>' +
      '<button class="btn btn-primary" onclick="navigateTo(\'landing\')" style="margin-top:1rem">返回首页</button></div>';
    return;
  }

  var hd = result.hexagramData;
  var catInfo = QUESTION_CATEGORIES[state.category] || QUESTION_CATEGORIES.general;
  var method = getInterpretationMethod(result.changingLines.length);

  var interps = hd.interpretations || {};
  var generalText = interps.general || '';
  var catText = interps[state.category] || '';
  var adviceText = interps.advice || '';

  // 变卦解读
  var changedHtml = '';
  if (result.changedHexagram && result.changedHexagram.hexagramData) {
    var chd = result.changedHexagram.hexagramData;
    var chInterps = chd.interpretations || {};
    var chCatText = chInterps[state.category] || chInterps.general || '';
    changedHtml =
      '<div class="card interp-section interp-changed">' +
        '<h3 class="interp-section-title interp-changed-title"><span class="ornament-marker">◆</span>变卦 · ' + escapeHtml(chd.fullName) + '</h3>' +
        '<p class="interp-changed-label">事情的发展趋势指向「' + escapeHtml(chd.name) + '」：</p>' +
        '<p class="interp-text">' + escapeHtml(chd.overview || '') + '</p>' +
        (chCatText ? '<p class="interp-text" style="margin-top:0.75rem">' + escapeHtml(chCatText) + '</p>' : '') +
      '</div>';
  }

  // 动爻提示
  var changingHtml = '';
  if (result.changingLines.length > 0) {
    var changingItemsHtml = result.changingLines.map(function(idx) {
      return '<div class="changing-line-item">' +
        '<span class="changing-line-pos">' + LINE_POSITIONS[idx] + '</span>' +
        '<p class="changing-line-text">此爻为动爻，提示事情在' + LINE_POSITIONS[idx] + '所代表的阶段有变化之机。' +
        (hd.caution ? ' 需注意：' + escapeHtml(hd.caution) : '') + '</p>' +
      '</div>';
    }).join('');

    changingHtml =
      '<div class="card interp-section interp-changing">' +
        '<h3 class="interp-section-title interp-changing-title"><span>◆</span>动爻提示 <span class="interp-section-title-sub">' + result.changingLines.length + ' 个动爻</span></h3>' +
        changingItemsHtml +
      '</div>';
  }

  // 关键词
  var keywordsHtml = '';
  if (hd.keywords && hd.keywords.length > 0) {
    keywordsHtml = '<div class="keywords-row">' +
      hd.keywords.map(function(kw) { return '<span class="keyword-tag">' + escapeHtml(kw) + '</span>'; }).join('') +
    '</div>';
  }

  container.innerHTML =
    '<div class="interp-page">' +
      '<div class="interp-inner">' +
        '<div class="interp-header">' +
          '<div class="interp-tag">' + catInfo.icon + ' ' + catInfo.name + ' · ' + escapeHtml(hd.fullName) + '</div>' +
          '<h2 class="section-title">卦象详解</h2>' +
          '<p class="interp-method">' + method.description + '</p>' +
        '</div>' +

        '<div class="card question-card">' +
          '<p class="question-card-label">🔮 所问之事</p>' +
          '<p class="question-card-text">' + escapeHtml(state.question) + '</p>' +
        '</div>' +

        '<div class="card interp-section">' +
          '<h3 class="interp-section-title"><span class="ornament-marker">◆</span>卦象概述 <span class="interp-section-title-sub">' + escapeHtml(hd.fullName) + ' · ' + escapeHtml(hd.fortune) + '</span></h3>' +
          '<p class="interp-text">' + escapeHtml(hd.overview || '') + '</p>' +
          keywordsHtml +
        '</div>' +

        '<div class="card interp-section">' +
          '<h3 class="interp-section-title"><span class="ornament-marker">◆</span>关于「' + catInfo.name + '」的解读</h3>' +
          '<p class="interp-text">' + escapeHtml(generalText) + '</p>' +
          (catText && catText !== generalText ?
            '<div class="interp-highlight">' +
              '<p class="interp-highlight-label">针对您的问题：</p>' +
              '<p class="interp-highlight-text">' + escapeHtml(catText) + '</p>' +
            '</div>' : ''
          ) +
        '</div>' +

        changingHtml +
        changedHtml +

        '<div class="card interp-section interp-advice">' +
          '<h3 class="interp-section-title interp-advice-title"><span class="ornament-marker">◆</span>建议与提醒</h3>' +
          (adviceText ? '<div class="advice-block"><p class="advice-label tip">💡 建议</p><p class="advice-text">' + escapeHtml(adviceText) + '</p></div>' : '') +
          (hd.caution ? '<div class="advice-block"><p class="advice-label warn">⚠️ 注意</p><p class="advice-text">' + escapeHtml(hd.caution) + '</p></div>' : '') +
        '</div>' +

        '<div class="interp-disclaimer">' +
          '<div class="divider"><span style="font-size:0.7rem">✦</span></div>' +
          '<p>以上解读基于周易卦象文化，仅供参考与学习交流。<br>人生的方向始终掌握在自己手中，卦象只是提供一种思考的角度。<br>如遇重大决策，请结合实际情况理性判断。</p>' +
        '</div>' +

        '<div class="guajin-hint">' +
          '<p class="guajin-hint-title">◆ 卦金之礼 ◆</p>' +
          '<p class="guajin-hint-text">古人云「卜筮不问未诚之人，卦金不受不诚之心」。<br>若此卦解读于你有所启发，不妨奉上一份卦金，以谢天地卦象之应、以敬心中所问之郑重。</p>' +
          '<button class="btn btn-primary guajin-cta" onclick="navigateTo(\'donation\')">✦ 奉上卦金 ✦</button>' +
        '</div>' +

        '<div class="interp-actions">' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'result\')">返回卦象</button>' +
          '<button class="btn btn-primary" onclick="startAIInterpretation()">AI 智能解卦</button>' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'donation\')">赏卦金 ☕</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ===== 打赏页 =====
function renderDonation(container) {
  container.innerHTML =
    '<div class="donation-page">' +
      '<div class="donation-inner">' +
        '<div class="donation-header">' +
          '<div class="donation-icon">🙏</div>' +
          '<h2 class="section-title">奉上卦金</h2>' +
          '<p>心存感念，方能与卦象相应</p>' +
        '</div>' +

        '<div class="card donation-tradition">' +
          '<p class="tradition-title">✦ 关于卦金 ✦</p>' +
          '<p class="tradition-text">' +
            '古有云：「卦不空出，术不空施」。'+
            '自古问卜之礼，皆需奉上卦金，非为财货之贵，而在<strong>心念之诚</strong>。'+
            '心诚则灵，无诚则应之不真。'+
          '</p>' +
          '<p class="tradition-text" style="margin-top:0.75rem">' +
            '此礼一奉，一为敬天地卦象之灵；'+
            '二为谢解卦之劳；'+
            '三为你自己心中的这份「郑重」——郑重问，方能郑重待。'+
          '</p>' +
        '</div>' +

        '<div class="card donation-codes">' +
          '<div class="donation-grid">' +
            '<div class="donation-code-item">' +
              '<div class="donation-qr wechat">' +
                '<img src="assets/wechat.jpeg" alt="微信收款码" loading="lazy">' +
              '</div>' +
              '<p class="donation-code-name">💚 微信支付</p>' +
            '</div>' +
            '<div class="donation-code-item">' +
              '<div class="donation-qr alipay">' +
                '<img src="assets/alipay.jpeg" alt="支付宝收款码" loading="lazy">' +
              '</div>' +
              '<p class="donation-code-name">💙 支付宝</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="donation-note">' +
          '<p>金额随心，多少皆是心意<br>' +
          '<span style="color:var(--gold-dark);font-size:0.8rem">✦ 6.6 / 8.8 / 16.6 / 66.6 皆为吉数 ✦</span></p>' +
        '</div>' +

        '<div class="donation-actions">' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'interpretation\')">返回解读</button>' +
          '<button class="btn btn-primary" onclick="restart()">再次占卦</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ===== 历史页 =====
function renderHistory(container) {
  var listHtml = '';
  if (state.history.length === 0) {
    listHtml = '<div class="history-empty">' +
      '<div class="history-empty-icon">📜</div>' +
      '<p>暂无占卜记录</p>' +
      '<p class="sub">占一次卦，记录就会出现在这里</p>' +
    '</div>';
  } else {
    listHtml = '<div class="history-list">';
    state.history.forEach(function(record) {
      var catInfo = QUESTION_CATEGORIES[record.category] || QUESTION_CATEGORIES.general;
      var hasLines = record.lines && record.lines.length === 6;
      var hasAI = !!record.aiInterpretation;
      listHtml += '<div class="card history-item' + (hasLines ? ' clickable' : '') + '"' +
        (hasLines ? ' onclick="openHistoryRecord(' + record.id + ')"' : '') + '>' +
        '<div class="history-item-top">' +
          '<div class="history-item-tags">' +
            '<span class="history-cat-tag">' + catInfo.icon + ' ' + catInfo.name + '</span>' +
            (hasAI ? '<span class="history-ai-tag">✦ 已 AI 解卦</span>' : '') +
          '</div>' +
          '<span class="history-date">' + formatDate(record.date) + '</span>' +
        '</div>' +
        '<p class="history-question">' + escapeHtml(record.question) + '</p>' +
        '<div class="history-meta">' +
          '<span class="history-hex-name">' + escapeHtml(record.hexagramName) + '</span>' +
          (record.fortune ? '<span class="history-fortune">' + escapeHtml(record.fortune) + '</span>' : '') +
          (record.changingLines > 0 ? '<span>' + record.changingLines + '个动爻</span>' : '') +
          (record.changedHexagram ? '<span>→ ' + escapeHtml(record.changedHexagram) + '</span>' : '') +
        '</div>' +
        (hasLines ? '<div class="history-view-hint">点击查看详情 →</div>' : '') +
      '</div>';
    });
    listHtml += '</div>';
  }

  container.innerHTML =
    '<div class="history-page">' +
      '<div class="history-inner">' +
        '<div class="history-header">' +
          '<h2 class="section-title">占卜记录</h2>' +
          '<p>回顾您过去的每一次占问</p>' +
        '</div>' +
        listHtml +
        '<div class="history-actions">' +
          '<button class="btn btn-secondary" onclick="navigateTo(\'landing\')">返回首页</button>' +
          (state.history.length > 0 ?
            '<button class="btn btn-secondary-danger" onclick="clearHistory()">清空记录</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
}

function clearHistory() {
  if (confirm('确定要清空所有占卜记录吗？')) {
    state.history = [];
    localStorage.removeItem(STORAGE_KEY);
    updateHistoryNav();
    renderHistory(document.getElementById('app'));
  }
}

// ===== 打开历史记录 =====
function openHistoryRecord(id) {
  var record = null;
  for (var i = 0; i < state.history.length; i++) {
    if (state.history[i].id === id) { record = state.history[i]; break; }
  }
  if (!record || !record.lines || record.lines.length !== 6) return;

  // 恢复状态
  state.question = record.question;
  state.category = record.category || 'general';
  state.lines = record.lines.map(function(l) {
    return {
      lineType: l.lineType,
      isYang: l.isYang,
      isChanging: l.isChanging
    };
  });
  state.hexagramResult = calculateHexagram(state.lines);
  state.currentRecordId = record.id;

  // 若历史里已有 AI 解读，恢复它，避免再次调用 API
  if (record.aiInterpretation) {
    state.aiInterpretation = record.aiInterpretation;
    state.aiInterpretationHexId = state.hexagramResult.hexagramData ? state.hexagramResult.hexagramData.number : null;
  } else {
    state.aiInterpretation = null;
    state.aiInterpretationHexId = null;
  }
  state.aiError = null;

  navigateTo('result');
}

// ===== 通用工具 =====
function restart() {
  state.question = '';
  state.category = 'general';
  state.lines = [];
  state.currentLine = 0;
  state.hexagramResult = null;
  state.flipPhase = 'idle';
  state.currentCoins = [];
  state.aiInterpretation = null;
  state.aiInterpretationHexId = null;
  state.aiError = null;
  navigateTo('landing');
}

// ===== 首页交互卡片 =====
function toggleCategory(el) {
  var wasOpen = el.classList.contains('expanded');
  // 先关闭所有卡片
  var cards = document.querySelectorAll('.category-card-interactive');
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove('expanded');
  }
  // 如果之前没展开，就展开这个
  if (!wasOpen) {
    el.classList.add('expanded');
  }
}

function pickQuestion(category, question) {
  state.category = category;
  state.question = question;
  navigateTo('question');
}

function escapeForAttr(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function toggleSound() {
  SoundEngine.enabled = !SoundEngine.enabled;
  if (SoundEngine.enabled) SoundEngine.playClick();
  renderPage();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

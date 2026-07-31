/**
 * Vercel Serverless Function - AI 解卦代理
 *
 * 部署到 Vercel 后，前端调用 /api/interpret，本函数：
 * 1. 校验 Referer 只允许自己的域名
 * 2. 基于 IP 做速率限制（每小时 5 次 / 每日 20 次）
 * 3. 用服务器环境变量里的 DEEPSEEK_KEY 转发请求
 *
 * 环境变量（在 Vercel 项目设置里配置）：
 * - DEEPSEEK_KEY: 你的 DeepSeek API Key
 * - ALLOWED_ORIGINS: 允许访问的域名（用逗号分隔），例如 "liuyao.vercel.app,你的域名.com"
 *                    留空则允许所有来源（不推荐上线用）
 */

// ===== 禁忌类问题校验（与前端 engine.js 保持一致）=====
const FORBIDDEN_TOPICS = [
  {
    name: '政治',
    keywords: ['习近平', '习大大', '国家主席', '总书记', '共产党', '中共', '国民党', '台独', '港独', '疆独', '藏独', '法轮功', '六四', '天安门事件', '文革', '党中央', '政变', '推翻', '选举结果', '总统选举', '大选', '战争爆发', '统一台湾', '武统', '中美关系', '中日关系', '朝鲜半岛'],
    message: '涉及政治议题，卦象不占。'
  },
  {
    name: '生死',
    keywords: ['我什么时候死', '我会死', '我能活', '我的寿命', '我什么时候走', '什么时候去世', '什么时候归天', '会不会死', '什么时候死', '死期', '寿元', '阳寿', '我爸什么时候', '我妈什么时候', '爷爷什么时候', '奶奶什么时候', '外公什么时候', '外婆什么时候', '自杀', '轻生', '结束生命', '我想死', '不想活', '杀人', '弄死'],
    message: '生死有命，卦象不测生死。若有心理困扰，请及时寻求专业帮助（心理援助热线：400-161-9995）。'
  },
  {
    name: '他人隐私',
    keywords: ['她是不是有别人', '他是不是有别人', '有没有出轨', '是不是出轨', '是不是骗我', '有没有小三', '有没有情人', '和谁在一起', '喜欢我什么', '暗恋我', '他心里有谁', '她心里有谁', '偷看', '偷听', '偷偷', '背着我', '瞒着我做', '有没有别的女人', '有没有别的男人'],
    message: '卦不占他人隐私。占卜以问己心为要，探人隐私非君子之道。'
  },
  {
    name: '胎儿男女',
    keywords: ['男孩女孩', '男孩还是女孩', '是儿子还是女儿', '生男生女', '男胎女胎', '肚子里是男', '肚子里是女', '怀的是男', '怀的是女', '预测性别', '胎儿性别', '宝宝性别'],
    message: '生男生女皆是缘分。卦不测胎儿性别，请以健康平安为念。'
  },
  {
    name: '投机博彩',
    keywords: ['赌', '彩票', '博彩', '赌博', '中奖', '双色球', '大乐透', '福彩', '体彩', '澳门', '赌场', '押大押小', '押注', '梭哈', '开奖号码', '中奖号码', '刮刮乐', '六合彩'],
    message: '君子爱财取之有道。卦不助赌，投机之事损人损己。'
  },
  {
    name: '股票理财',
    keywords: ['买什么股票', '哪只股票', '股票代码', '涨停', '跌停', '涨幅', '追涨', '抄底', '哪只基金', '买哪个基金', '哪个币', '哪种币', '比特币会涨', '数字货币', '合约交易', '炒股', '炒币', '期货能', '外汇能'],
    message: '投资有风险，卦象非荐股。理财决策请咨询持牌专业顾问，勿以卦象作为投资依据。'
  },
  {
    name: '鬼神灵异',
    keywords: ['前世', '来世', '轮回', '投胎', '鬼上身', '鬼附身', '有鬼', '闹鬼', '通灵', '招魂', '通阴', '阴间', '阎王', '孟婆', '牛头马面', '黄鼠狼', '狐仙', '出马', '仙家', '看到鬼', '梦见鬼', '被下降头', '中邪', '被诅咒', '风水破', '斩桃花'],
    message: '子不语怪力乱神。卦象重在参悟人生方向，不涉鬼神灵异之说。'
  },
  {
    name: '违法伤人',
    keywords: ['报复', '整死', '弄残', '毒害', '下毒', '投毒', '陷害', '构陷', '举报能不能扳倒', '如何逃避法律', '如何脱罪', '走私能', '贩毒', '洗钱', '偷税', '漏税', '作弊', '考试作弊', '论文抄袭', '代考'],
    message: '此类问题涉及违法或伤人之事，卦不占。如有法律困惑，请咨询专业律师。'
  }
];

function checkForbiddenTopics(question) {
  const q = (question || '').toLowerCase();
  for (const topic of FORBIDDEN_TOPICS) {
    for (const kw of topic.keywords) {
      if (q.indexOf(kw.toLowerCase()) !== -1) {
        return { hit: true, topic: topic.name, message: topic.message };
      }
    }
  }
  return { hit: false };
}

// 简单的内存速率限制器（Vercel Serverless 是无状态的，每个实例独立计数
// 生产用建议接入 Upstash Redis 或 Vercel KV 做全局限流）
const rateLimitMap = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { hourly: [], daily: [] };

  // 清理过期记录
  record.hourly = record.hourly.filter(t => now - t < 3600_000);       // 1 小时
  record.daily = record.daily.filter(t => now - t < 86400_000);        // 24 小时

  // 单 IP：每小时最多 5 次，每日最多 20 次
  if (record.hourly.length >= 5) {
    return { ok: false, reason: 'hourly_limit', message: '同一小时内最多问卦5次，请稍后再来。心诚方能得应。' };
  }
  if (record.daily.length >= 20) {
    return { ok: false, reason: 'daily_limit', message: '今日问卦已达20次，请明日再来。频繁问卦，卦象不灵。' };
  }

  record.hourly.push(now);
  record.daily.push(now);
  rateLimitMap.set(ip, record);
  return { ok: true };
}

function checkOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;  // 未配置则允许所有（本地测试）

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';

  return allowed.some(host => {
    return origin.includes(host) || referer.includes(host);
  });
}

export default async function handler(req, res) {
  // 只接受 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 校验来源
  if (!checkOrigin(req)) {
    return res.status(403).json({ error: '来源不合法' });
  }

  // 速率限制
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.ok) {
    return res.status(429).json({ error: rateCheck.message, reason: rateCheck.reason });
  }

  // 校验请求体
  const { question, category, hexagram } = req.body || {};
  if (!question || !hexagram) {
    return res.status(400).json({ error: '请求参数不完整' });
  }
  if (typeof question !== 'string' || question.length > 500) {
    return res.status(400).json({ error: '问题格式不合法' });
  }

  // 禁忌类别兜底校验（防止前端被绕过）
  const forbidCheck = checkForbiddenTopics(question);
  if (forbidCheck.hit) {
    return res.status(400).json({
      error: forbidCheck.message,
      forbidden: true,
      topic: forbidCheck.topic
    });
  }

  // 获取 DeepSeek Key
  const apiKey = process.env.DEEPSEEK_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务未配置 API Key' });
  }

  // 构建 prompt
  const categoryNames = {
    career: '事业', love: '感情', wealth: '财运', health: '健康',
    study: '学业', decision: '抉择', general: '综合'
  };
  const categoryName = categoryNames[category] || '综合';

  const systemPrompt = '你是一位精通六爻卦象的国学顾问。你擅长用通俗易懂、温暖有力的语言为用户解读卦象。你的风格是：像一个有智慧、有阅历的朋友在和你深谈——既有洞察力，又有温度。你不说套话，不说空话，每一句都落在用户的具体处境上。';

  const userPrompt = '用户用六爻占了一卦，请你为他深度解读。\n\n' +
    '【用户的问题】\n' + question + '\n\n' +
    '【问题类别】\n' + categoryName + '\n\n' +
    '【卦象信息】\n' + hexagram + '\n\n' +
    '请按以下结构生成解读，用加粗小标题分段：\n\n' +

    '第一个小标题「当前处境」：用2-3句点明卦象映射到用户现实中的状态。把卦象的含义翻译成用户能感受到的一句话。要具体到用户的问题场景。\n\n' +

    '第二个小标题（根据问题类型自拟）：这是分析的核心段落，4-6句。要求：\n' +
    '- 用比喻和意象来分析，不要干巴巴地说"卦象显示"\n' +
    '- 如果用户问的是选择类问题（A还是B），分别分析两个方向的利弊\n' +
    '- 如果用户问的是关系类问题，分析关系中的能量流动\n' +
    '- 如果用户问的是时机类问题，分析当前时机的特点\n' +
    '- 分析要有层次感和深度，像剥洋葱一样一层层深入\n\n' +

    '第三个小标题「建议与方向」：3-4句具体建议。要求：\n' +
    '- 如果卦象暗示需要等待，说清楚等的是什么、大概是什么状态\n' +
    '- 如果卦象暗示需要行动，第一步做什么\n' +
    '- 如果面临两难，帮用户理清每个选择的代价和收获\n' +
    '- 建议要落地，不要"保持好心态"这种空话\n\n' +

    '最后一个短段落：一句有力量的收尾，让人读完心里有方向感。\n\n' +

    '写作要求：\n' +
    '- 全文600-900字\n' +
    '- 用"你"来对话\n' +
    '- 绝对不要用"本卦""变卦""动爻""爻辞""用神""世应""六亲""相害""相合"等术语\n' +
    '- 不做绝对判断\n' +
    '- 涉及健康→提醒就医；涉及法律→提醒咨询律师';

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek error:', response.status, errText);
      return res.status(502).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(502).json({ error: 'AI 返回内容为空' });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Interpret error:', err);
    return res.status(500).json({ error: '服务异常，请稍后再试' });
  }
}

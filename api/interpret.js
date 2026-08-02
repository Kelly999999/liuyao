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

  // 单 IP：每小时最多 10 次，每日最多 20 次
  if (record.hourly.length >= 10) {
    return { ok: false, reason: 'hourly_limit', message: '同一小时内最多问卦10次，请稍后再来。心诚方能得应。' };
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

  // 构建 prompt —— 专业六爻断卦结构
  const categoryNames = {
    career: '事业（官运/工作/职场/创业）', love: '感情（婚恋/姻缘/复合/桃花）',
    wealth: '财运（投资/理财/收入/生意）', health: '健康（身体/养生/疾病）',
    study: '学业（考试/升学/进修/证书）', decision: '抉择（两难选择/方向决策）',
    general: '综合（其他人生问题）'
  };
  const categoryName = categoryNames[category] || '综合（其他人生问题）';

  // 各类型的"用神"说明（供 AI 参考）
  const yongShenMap = {
    career:   { yongShen: '官鬼爻（为事业、职位、领导），次看父母爻（为文书、机会、公司）、妻财爻（为薪酬、收益）、世爻（为求测人自身状态）',
                relation: '世为求测人，应为职位/公司/事体；官鬼持世或生世为吉，克世则压力大、岗位不稳' },
    love:     { yongShen: '男占以妻财爻为用神（为女友/妻子/感情）；女占以官鬼爻为用神（为男友/丈夫/感情）；兼看世应关系（世=己，应=对方）',
                relation: '世应相合相生主和睦，相冲相克主矛盾；用神旺相持世或生合世爻为吉，空亡/休囚/被克为不利' },
    wealth:   { yongShen: '妻财爻为用神（为财富、本金、收益）；次看子孙爻（为财源、客户、机会）、兄弟爻（为破财、劫财、竞争）、世爻（为自己承受力）',
                relation: '财爻旺相、子孙动而生财为吉；兄动克财为破财之象；财持世或生合世爻易得财' },
    health:   { yongShen: '官鬼爻为用神（为疾病、病灶）；次看子孙爻（为医药、医生、克制疾病之力）、世爻（为自身元气）、父母爻（为劳累、思虑、压力）',
                relation: '官鬼休囚、安静，子孙旺动克制官鬼为吉；官鬼持世克世、或多官鬼为病多反复；世爻旺相元气足，休囚空亡为体虚' },
    study:    { yongShen: '父母爻为用神（为文书、录取、学业成果）；次看官鬼爻（为名次、压力、考试运）、子孙爻（为思维、悟性、发挥）、世爻（为自身努力）',
                relation: '父母旺相、官生父母为利；世爻旺相持或生合父母，主自身努力有回报' },
    decision: { yongShen: '世爻为求测人（立场、状态）；应为所选之事/对方；A/B两选分别参看变卦与本卦指向的六亲力量。另看动爻所指、合冲指向',
                relation: '世旺则有能力承受选择结果；应生合世为所选方向有利，克冲世为不利；动爻生合何卦，何卦更有推动力' },
    general:  { yongShen: '综合取用神：先看世应关系，再按具体问题倾向取最相关的六亲；动爻为重，静卦看旺衰',
                relation: '世为己，应为事/人；生合为助，克冲为阻' }
  };
  const yongShenInfo = yongShenMap[category] || yongShenMap.general;

  const systemPrompt = '你是一位精通京房六爻纳甲体系的资深国学顾问，擅长用专业而直白的方式为问者解读卦象。' +
    '你精通世应生克、六亲取象、月建日辰旺衰、动爻卦变、空亡冲合。' +
    '你的风格是：像一位经验丰富、温和笃定的老师与朋友，不说空话套话，每一段都落在用户的具体问题上；' +
    '专业术语可以使用，但每个术语后面必须用一句话翻译成用户能理解的人话。' +
    '结论必须明确：利/不利、选A/选B、时机何时、风险点在哪、怎么应对。';

  const userPrompt = '请用六爻纳甲断卦法，为我深度解读以下这一卦。请严格按下面的结构输出，每个部分用加粗小标题分段：\n\n' +

    '=== 用户输入 ===\n' +
    '【具体问题】' + question + '\n' +
    '【问题类别】' + categoryName + '\n\n' +

    '=== 六爻专业排盘 ===\n' +
    hexagram + '\n\n' +

    '=== 断卦参考（供你使用但不要直接复述）===\n' +
    '· 本类问题用神参考：' + yongShenInfo.yongShen + '\n' +
    '· 世应/关系要点：' + yongShenInfo.relation + '\n\n' +

    '====== 请按以下 6 个部分解读 ======\n\n' +

    '① **第一部分·卦象总论**（必须有，2-3句）：用一句话点明本卦/变卦的卦名、卦性（六合/六冲、卦宫五行），并用最通俗的比喻说清这卦的整体气质。例如：「本卦是雷地豫，像春天万物舒展，本来一片顺畅，但六爻皆动说明你现在心里也跟着翻江倒海。」\n\n' +

    '② **第二部分·用神与世应关系**（核心分析，必须有，4-7句）：' +
    '第一步：根据问题类型，明确指出你选哪个爻作为「用神」，为什么选。' +
    '第二步：分析「世爻」（代表求测人自己）的状态：五行、旺相休囚、是否旬空、是否被月/日冲合、是否动爻。这关系到用户"自己有没有力量、状态怎么样"。' +
    '第三步：分析「应爻」（代表对方/事体）与用神的状态，以及它们和世爻的生克关系——是世生应（我单方面付出）、应生世（对方帮我/事助我）、世克应（我能掌控）、应克世（对方压我/事不顺我）、比和（势均力敌），还是相合/相冲。' +
    '每一个结论后面，必须跟一句人话翻译：比如「应爻官鬼丑土克世爻午火→直白讲就是，他(这份工作/这段关系)在消耗你，你越投入越累」。\n\n' +

    '③ **第三部分·能量强弱与动爻变局**（必须有，4-7句）：' +
    '分析月建和日辰对用神、世爻的生克冲合（谁得月令生扶为得时，谁被日冲为冲动/日破，谁旬空为暂时无力）。' +
    '如果卦中有动爻：逐一分析每个动爻的身份（六亲）、力量、变出的爻是什么六亲——这个动爻是在「生用神/世」还是「克用神/世」，是事情的"推动力量"还是"阻碍力量"，是吉动还是凶动。' +
    '如果无动爻(静卦)：分析静卦中力量最强的两三个爻之间的生克关系，指出卦中最关键的支点是什么。' +
    '最后根据本卦→变卦的转换，点明「事态的开始→结束」的整体走向。\n\n' +

    '④ **第四部分·针对问题的具体断语**（必须有，3-5句）：' +
    '结合以上分析，对用户的具体问题给出明确的、非模棱两可的判断。' +
    '- 如果是感情问题：两人最终走向如何？当下最关键的卡点是什么？谁更在乎谁？应该推进还是后撤？' +
    '- 如果是事业/工作问题：这份工作/这次机会最终能成吗？自己能驾驭吗？还是另谋高就？' +
    '- 如果是财运问题：这笔投资能赚吗？风险点在哪？该进该退？金额/时机有什么暗示？' +
    '- 如果是抉择问题：分别回答「选A会怎样」「选B会怎样」，并明确给出倾向建议，不能两边都好或两边都坏。' +
    '- 如果是健康问题：指出卦中反映的身体部位倾向（以象推，非医疗诊断），并提醒就医，给出调理方向。\n\n' +

    '⑤ **第五部分·建议与行动**（必须有，3-4条具体建议，逐条列出）：' +
    '建议必须是「可操作」的，不要"保持好心态""多行善"这类空话。' +
    '比如：「如果问的是分手复合→建议：第1，未来20天不要主动联系，他会回头找你；第2，把住在一起的东西先搬回来，卦中妻财入库主对方需要空间；第3，辰月(约清明后)会有实质性转机」。' +
    '再比如：「如果问的是跳槽→建议：1) 这份新offer最终会压薪资，谈判时坚持你原来的底线；2) 留在原公司反而在午月(约端午后)有晋升机会；3) 不建议裸辞，卦中官鬼空亡主跳槽后空档期超预期」。' +
    '时间点请尽量用"X月(节气名)前后"这种人话描述，不要只给干支。\n\n' +

    '⑥ **第六部分·一句收尾**（必须有，1句）：一句有力量、让人心里踏实的话，温暖笃定，给人方向感。\n\n' +

    '写作硬规则：\n' +
    '- 全文600-1200字；用"你"来称呼问卦人；\n' +
    '- **专业术语必须用，但每个术语第一次出现时必须在括号里或紧跟一句人话翻译**；不要堆砌术语而不解释；\n' +
    '- 绝对不要空泛，所有分析都必须紧扣卦中具体的爻(比如"三爻妻财亥水旬空""五爻官鬼酉金动而生世")，而不是"卦象显示""此卦表明"这种空话；\n' +
    '- 不做绝对化断言，但要明确倾向：用"大概率""更倾向""建议优先"这类词而不是"一定""绝对"；\n' +
    '- 涉及健康→明确提醒就医；涉及法律/财务决策→提醒咨询持牌专业人士；\n' +
    '- 分段清晰，加粗小标题用上面①-⑥的文字（可以加emoji让它好看）。';

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

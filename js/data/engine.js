/**
 * 六爻算卦引擎 - 纯 JS 版本
 */

// 八卦数据
var TRIGRAMS = {
  '111': { name: '乾', nature: '天', symbol: '☰', binary: '111' },
  '110': { name: '兑', nature: '泽', symbol: '☱', binary: '110' },
  '101': { name: '离', nature: '火', symbol: '☲', binary: '101' },
  '100': { name: '震', nature: '雷', symbol: '☳', binary: '100' },
  '011': { name: '巽', nature: '风', symbol: '☴', binary: '011' },
  '010': { name: '坎', nature: '水', symbol: '☵', binary: '010' },
  '001': { name: '艮', nature: '山', symbol: '☶', binary: '001' },
  '000': { name: '坤', nature: '地', symbol: '☷', binary: '000' },
};

var COIN_FACE = 3; // 字（正面）
var COIN_BACK = 2; // 背（反面）

var LINE_TYPES = {
  old_yin:    { label: '老阴', isYang: false, isChanging: true,  changedTo: 'young_yang' },
  young_yang: { label: '少阳', isYang: true,  isChanging: false },
  young_yin:  { label: '少阴', isYang: false, isChanging: false },
  old_yang:   { label: '老阳', isYang: true,  isChanging: true,  changedTo: 'young_yin' },
};

var LINE_POSITIONS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

var QUESTION_CATEGORIES = {
  career:    { name: '事业', icon: '💼', description: '工作、升职、跳槽、创业等' },
  love:      { name: '感情', icon: '💕', description: '恋爱、婚姻、复合、桃花等' },
  wealth:    { name: '财运', icon: '💰', description: '投资、理财、收入等' },
  health:    { name: '健康', icon: '🌿', description: '身体状况、养生等' },
  study:     { name: '学业', icon: '📚', description: '考试、升学、学业方向等' },
  decision:  { name: '抉择', icon: '🧭', description: '面临选择、需要决断' },
  general:   { name: '综合', icon: '🌟', description: '其他综合性问题' },
};

// 禁忌类问题（按类别分组，每组含关键词和给用户的解释）
var FORBIDDEN_TOPICS = [
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
    message: '卦不占他人隐私。占卜以问己心为要，探人隐私非君子之道。请围绕"你自己"的处境和选择来问。'
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

// 旧的通用敏感词兜底（保留一部分不便归类的）
var SENSITIVE_KEYWORDS = [
  '犯罪', '犯法', '违法'
];

/**
 * 模拟掷三枚铜钱
 */
function throwCoins() {
  var coins = [
    Math.random() > 0.5 ? COIN_FACE : COIN_BACK,
    Math.random() > 0.5 ? COIN_FACE : COIN_BACK,
    Math.random() > 0.5 ? COIN_FACE : COIN_BACK,
  ];
  var sum = coins[0] + coins[1] + coins[2];

  var lineType, isChanging;
  switch (sum) {
    case 6: lineType = 'old_yin';    isChanging = true;  break;
    case 7: lineType = 'young_yang'; isChanging = false; break;
    case 8: lineType = 'young_yin';  isChanging = false; break;
    case 9: lineType = 'old_yang';   isChanging = true;  break;
    default: throw new Error('Invalid coin sum: ' + sum);
  }

  return {
    coins: coins,
    sum: sum,
    lineType: lineType,
    isChanging: isChanging,
    isYang: lineType === 'young_yang' || lineType === 'old_yang',
  };
}

/**
 * 根据六爻结果计算卦象
 */
function calculateHexagram(lines) {
  // 下卦（内卦）：第1-3爻
  var lowerBinary = lines.slice(0, 3).map(function(l) { return l.isYang ? '1' : '0'; }).join('');
  // 上卦（外卦）：第4-6爻
  var upperBinary = lines.slice(3, 6).map(function(l) { return l.isYang ? '1' : '0'; }).join('');

  var lowerTrigram = TRIGRAMS[lowerBinary];
  var upperTrigram = TRIGRAMS[upperBinary];
  var hexagramData = findHexagram(upperTrigram.name, lowerTrigram.name);

  // 检查变爻
  var changingLines = [];
  lines.forEach(function(line, idx) {
    if (line.isChanging) changingLines.push(idx);
  });

  // 计算变卦
  var changedHexagram = null;
  if (changingLines.length > 0) {
    var changedLines = lines.map(function(line) {
      if (!line.isChanging) return line;
      var changedType = LINE_TYPES[line.lineType].changedTo;
      return {
        lineType: changedType,
        isYang: LINE_TYPES[changedType].isYang,
        isChanging: false,
      };
    });

    var cLower = changedLines.slice(0, 3).map(function(l) { return l.isYang ? '1' : '0'; }).join('');
    var cUpper = changedLines.slice(3, 6).map(function(l) { return l.isYang ? '1' : '0'; }).join('');
    var cLowerT = TRIGRAMS[cLower];
    var cUpperT = TRIGRAMS[cUpper];
    changedHexagram = {
      lines: changedLines,
      lowerTrigram: cLowerT,
      upperTrigram: cUpperT,
      hexagramData: findHexagram(cUpperT.name, cLowerT.name),
    };
  }

  var result = {
    lines: lines,
    lowerTrigram: lowerTrigram,
    upperTrigram: upperTrigram,
    hexagramData: hexagramData,
    changingLines: changingLines,
    changedHexagram: changedHexagram,
    hasChanging: changingLines.length > 0,
  };

  // ===== 专业六爻装卦（纳甲/六亲/六神/世应/卦宫/四柱/旬空/神煞）=====
  if (typeof window !== 'undefined' && window.LiuyaoEngine) {
    try {
      var installLines = lines.map(function (l) {
        return { isYang: l.isYang, isChanging: l.isChanging };
      });
      var pro = window.LiuyaoEngine.installHexagram(
        upperTrigram.name, lowerTrigram.name, installLines, new Date()
      );
      // 生成给 AI 用的专业文本摘要
      pro.summaryText = window.LiuyaoEngine.buildSummaryText(
        upperTrigram.name, lowerTrigram.name,
        { palace: pro.palace, palaceWuxing: pro.palaceWuxing, shiPos: pro.shiPos, yingPos: pro.yingPos,
          liuChong: pro.liuChong, liuHe: pro.liuHe },
        pro.mainLines, pro.changedMeta, pro.hasChanging !== undefined ? pro.hasChanging : (!!pro.changedLines),
        pro.siZhu, pro.xunKong, pro.dateInfo.solar
      );
      // 把变卦六爻信息（如果有变）也补到 summaryText 中
      if (pro.changedLines && pro.changedLines.length) {
        var extra = '\n【变卦六爻】（参考未来走向）\n';
        for (var pp = 5; pp >= 0; pp--) {
          var C = pro.changedLines[pp];
          extra += '  · ' + C.ganZhi + ' ' + C.zhiWuxing + ' ' + C.liuQin
                 + (C.isShi ? ' 世' : '') + (C.isYing ? ' 应' : '')
                 + (C.isKong ? ' 空亡' : '') + '\n';
        }
        pro.summaryText += extra;
      }
      result.proPaipan = pro;
    } catch (e) {
      // 装卦失败不影响主流程
      if (window.console) console.warn('[engine] 专业装卦失败：', e);
      result.proPaipan = null;
    }
  } else {
    result.proPaipan = null;
  }

  return result;
}

/**
 * 根据上下卦查找64卦数据
 */
function findHexagram(upperName, lowerName) {
  if (typeof window.hexagramsData === 'undefined') return null;
  for (var i = 0; i < window.hexagramsData.length; i++) {
    var h = window.hexagramsData[i];
    if (h.upperTrigram === upperName && h.lowerTrigram === lowerName) {
      return h;
    }
  }
  return null;
}

/**
 * 校验问题
 */
/**
 * 检查问题是否命中禁忌类别
 * @returns {{ hit: boolean, topic?: string, message?: string }}
 */
function checkForbiddenTopics(question) {
  var q = (question || '').toLowerCase();
  for (var i = 0; i < FORBIDDEN_TOPICS.length; i++) {
    var topic = FORBIDDEN_TOPICS[i];
    for (var j = 0; j < topic.keywords.length; j++) {
      if (q.indexOf(topic.keywords[j].toLowerCase()) !== -1) {
        return { hit: true, topic: topic.name, message: topic.message };
      }
    }
  }
  return { hit: false };
}

function validateQuestion(question) {
  if (!question || question.trim().length < 5) {
    return { valid: false, message: '请至少输入5个字，详细描述您的问题' };
  }
  if (question.trim().length > 200) {
    return { valid: false, message: '问题描述太长了，请精简到200字以内' };
  }

  // 禁忌类别校验（政治/生死/隐私/胎儿性别/博彩/股票/鬼神/违法）
  var forbid = checkForbiddenTopics(question);
  if (forbid.hit) {
    return { valid: false, forbidden: true, topic: forbid.topic, message: forbid.message };
  }

  // 通用敏感词兜底
  for (var i = 0; i < SENSITIVE_KEYWORDS.length; i++) {
    if (question.indexOf(SENSITIVE_KEYWORDS[i]) !== -1) {
      return { valid: false, message: '此类问题不适合占卜，请换一个关于人生方向的问题' };
    }
  }

  var vaguePatterns = [
    /^我的命(运|怎么样|好不好)/,
    /^我(的)?一生/,
    /^(算一下|占一卦|帮我算|帮我占)$/,
  ];
  for (var k = 0; k < vaguePatterns.length; k++) {
    if (vaguePatterns[k].test(question.trim())) {
      return { valid: false, message: '问题太宽泛了，请具体描述您想了解的事情，比如"我应该换工作吗？"' };
    }
  }

  return { valid: true, message: '' };
}

/**
 * 自动推断问题类别
 */
function inferCategory(question) {
  var q = question.toLowerCase();
  var categoryKeywords = {
    career: ['工作', '上班', '升职', '跳槽', '辞职', '创业', '事业', '公司', '老板', '同事', '项目', '面试', 'offer', '加薪'],
    love: ['恋爱', '感情', '婚姻', '结婚', '分手', '复合', '对象', '男朋友', '女朋友', '老公', '老婆', '桃花', '姻缘', '暗恋', '表白', '离婚'],
    wealth: ['财', '钱', '投资', '理财', '股票', '基金', '买房', '贷款', '收入', '工资', '生意', '赚钱'],
    health: ['身体', '健康', '生病', '病', '医', '减肥', '养生', '失眠', '头疼', '体检'],
    study: ['考试', '考研', '高考', '学习', '升学', '留学', '毕业', '论文', '证书', '公务员'],
    decision: ['应该', '还是', '要不要', '该不该', '选择', '犹豫', '纠结', '何去何从'],
  };

  var cats = Object.keys(categoryKeywords);
  for (var i = 0; i < cats.length; i++) {
    var keywords = categoryKeywords[cats[i]];
    for (var j = 0; j < keywords.length; j++) {
      if (q.indexOf(keywords[j]) !== -1) return cats[i];
    }
  }
  return 'general';
}

/**
 * 获取解卦方式
 */
function getInterpretationMethod(changingCount) {
  var methods = [
    { title: '静卦', description: '无变爻，以本卦卦辞断之', useMain: true, useChanged: false },
    { title: '一变', description: '一爻变，以本卦变爻爻辞断之', useMain: true, useChanged: false },
    { title: '二变', description: '二爻变，以本卦二变爻爻辞断之，以上爻为主', useMain: true, useChanged: false },
    { title: '三变', description: '三爻变，以本卦卦辞与变卦卦辞参断', useMain: true, useChanged: true },
    { title: '四变', description: '四爻变，以变卦二不变爻爻辞断之', useMain: false, useChanged: true },
    { title: '五变', description: '五爻变，以变卦不变爻爻辞断之', useMain: false, useChanged: true },
    { title: '六变', description: '六爻皆变，以变卦卦辞断之', useMain: false, useChanged: true },
  ];
  return methods[Math.min(changingCount, 6)] || methods[0];
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  var date = new Date(dateStr);
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours = String(date.getHours()).padStart(2, '0');
  var minutes = String(date.getMinutes()).padStart(2, '0');
  return month + '月' + day + '日 ' + hours + ':' + minutes;
}

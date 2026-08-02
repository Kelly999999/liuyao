/**
 * 六爻专业装卦引擎
 * 包含：天干地支、五行、纳甲、卦宫、世应、六亲、六神、旬空、四柱、神煞
 * 仅供学习与文化交流使用
 */
(function () {
  'use strict';

  // ===== 基础常量 =====
  var TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var DI_ZHI   = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  var GAN_WUXING = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
  var ZHI_WUXING = { '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };

  // 生克：生我/我生/克我/我克
  var WUXING_SHENG = { '金':'水','水':'木','木':'火','火':'土','土':'金' };
  var WUXING_KE    = { '金':'木','木':'土','土':'水','水':'火','火':'金' };

  // 地支藏干（主气+中气+余气）
  var ZHI_CANG_GAN = {
    '子': ['癸'],
    '丑': ['己','癸','辛'],
    '寅': ['甲','丙','戊'],
    '卯': ['乙'],
    '辰': ['戊','乙','癸'],
    '巳': ['丙','戊','庚'],
    '午': ['丁','己'],
    '未': ['己','丁','乙'],
    '申': ['庚','壬','戊'],
    '酉': ['辛'],
    '戌': ['戊','辛','丁'],
    '亥': ['壬','甲']
  };

  // ===== 六十四卦卦宫表 =====
  // upper / lower 必须是八卦名（乾兑离震巽坎艮坤）
  // palaceWuxing: 卦宫五行
  // shiPos / yingPos: 0=初 1=二 2=三 3=四 4=五 5=上
  // 八纯卦世在上爻(5)，应在三爻(2)；一世世0应3，二世世1应4，三世世2应5，四世世3应0，五世世4应1，游魂世3应0，归魂世2应5
  var PALACE_MAP = {};
  function def(upper, lower, palace, palaceWx, shi, ying, flags) {
    flags = flags || {};
    PALACE_MAP[upper + lower] = {
      upper:upper, lower:lower,
      palace:palace, palaceWuxing:palaceWx,
      shiPos:shi, yingPos:ying,
      liuChong:!!flags.chong, liuHe:!!flags.he
    };
  }

  // ========== 乾宫（金）==========
  def('乾','乾','乾宫','金',5,2,{chong:true});   // 1 乾为天 纯卦 六冲
  def('乾','巽','乾宫','金',0,3);                // 44 天风姤 一世
  def('乾','艮','乾宫','金',1,4);                // 33 天山遁 二世
  def('乾','坤','乾宫','金',2,5,{he:true});      // 12 天地否 三世 六合
  def('巽','坤','乾宫','金',3,0);                // 20 风地观 四世
  def('艮','坤','乾宫','金',4,1);                // 23 山地剥 五世
  def('离','坤','乾宫','金',3,0);                // 35 火地晋 游魂
  def('离','乾','乾宫','金',2,5,{chong:true});   // 14 火天大有 归魂 六冲

  // ========== 兑宫（金）==========
  def('兑','兑','兑宫','金',5,2);                // 58 兑为泽 纯卦
  def('兑','坎','兑宫','金',0,3);                // 47 泽水困 一世
  def('兑','坤','兑宫','金',1,4);                // 45 泽地萃 二世
  def('兑','艮','兑宫','金',2,5,{he:true});      // 31 泽山咸 三世 六合
  def('坎','艮','兑宫','金',3,0);                // 39 水山蹇 四世
  def('坤','艮','兑宫','金',4,1);                // 15 地山谦 五世
  def('震','艮','兑宫','金',3,0,{chong:true});   // 62 雷山小过 游魂 六冲
  def('震','兑','兑宫','金',2,5);                // 54 雷泽归妹 归魂

  // ========== 离宫（火）==========
  def('离','离','离宫','火',5,2,{chong:true});   // 30 离为火 纯卦 六冲
  def('离','艮','离宫','火',0,3);                // 56 火山旅 一世
  def('离','巽','离宫','火',1,4);                // 50 火风鼎 二世
  def('离','坎','离宫','火',2,5,{chong:true});   // 64 火水未济 三世 六冲
  def('艮','坎','离宫','火',3,0);                // 4 山水蒙 四世
  def('巽','坎','离宫','火',4,1);                // 59 风水涣 五世
  def('乾','坎','离宫','火',3,0);                // 6 天水讼 游魂
  def('乾','离','离宫','火',2,5);                // 13 天火同人 归魂

  // ========== 震宫（木）==========
  def('震','震','震宫','木',5,2,{chong:true});   // 51 震为雷 纯卦 六冲
  def('震','坤','震宫','木',0,3,{he:true});      // 16 雷地豫 一世 六合
  def('震','坎','震宫','木',1,4);                // 40 雷水解 二世
  def('震','巽','震宫','木',2,5,{he:true});      // 32 雷风恒 三世 六合
  def('坤','巽','震宫','木',3,0);                // 46 地风升 四世
  def('坎','巽','震宫','木',4,1);                // 48 水风井 五世
  def('兑','巽','震宫','木',3,0);                // 28 泽风大过 游魂
  def('兑','震','震宫','木',2,5,{chong:true});   // 17 泽雷随 归魂 六冲

  // ========== 巽宫（木）==========
  def('巽','巽','巽宫','木',5,2);                // 57 巽为风 纯卦
  def('巽','乾','巽宫','木',0,3);                // 9 风天小畜 一世
  def('巽','离','巽宫','木',1,4);                // 37 风火家人 二世
  def('巽','震','巽宫','木',2,5,{he:true});      // 42 风雷益 三世 六合
  def('乾','震','巽宫','木',3,0);                // 25 天雷无妄 四世
  def('离','震','巽宫','木',4,1);                // 21 火雷噬嗑 五世
  def('艮','震','巽宫','木',3,0);                // 27 山雷颐 游魂
  def('艮','巽','巽宫','木',2,5,{chong:true});   // 18 山风蛊 归魂 六冲

  // ========== 坎宫（水）==========
  def('坎','坎','坎宫','水',5,2,{chong:true});   // 29 坎为水 纯卦 六冲
  def('坎','兑','坎宫','水',0,3);                // 60 水泽节 一世
  def('坎','震','坎宫','水',1,4);                // 3 水雷屯 二世
  def('坎','离','坎宫','水',2,5);                // 63 水火既济 三世
  def('兑','离','坎宫','水',3,0);                // 49 泽火革 四世
  def('震','离','坎宫','水',4,1);                // 55 雷火丰 五世
  def('坤','离','坎宫','水',3,0);                // 36 地火明夷 游魂
  def('坤','坎','坎宫','水',2,5);                // 7 地水师 归魂

  // ========== 艮宫（土）==========
  def('艮','艮','艮宫','土',5,2,{chong:true});   // 52 艮为山 纯卦 六冲
  def('艮','离','艮宫','土',0,3);                // 22 山火贲 一世
  def('艮','乾','艮宫','土',1,4);                // 26 山天大畜 二世
  def('艮','兑','艮宫','土',2,5,{he:true});      // 41 山泽损 三世 六合
  def('离','兑','艮宫','土',3,0);                // 38 火泽睽 四世
  def('乾','兑','艮宫','土',4,1);                // 10 天泽履 五世
  def('巽','兑','艮宫','土',3,0);                // 61 风泽中孚 游魂
  def('巽','艮','艮宫','土',2,5,{he:true});      // 53 风山渐 归魂 六合

  // ========== 坤宫（土）==========
  def('坤','坤','坤宫','土',5,2,{he:true});      // 2 坤为地 纯卦 六合
  def('坤','震','坤宫','土',0,3,{he:true});      // 24 地雷复 一世 六合
  def('坤','兑','坤宫','土',1,4);                // 19 地泽临 二世
  def('坤','乾','坤宫','土',2,5,{he:true});      // 11 地天泰 三世 六合
  def('震','乾','坤宫','土',3,0,{chong:true});   // 34 雷天大壮 四世 六冲
  def('兑','乾','坤宫','土',4,1);                // 43 泽天夬 五世
  def('坎','乾','坤宫','土',3,0);                // 5 水天需 游魂
  def('坎','坤','坤宫','土',2,5);                // 8 水地比 归魂

  // ===== 纳甲（京房）=====
  var NAJIA = {
    '乾': { inner:[['甲','子'],['甲','寅'],['甲','辰']], outer:[['壬','午'],['壬','申'],['壬','戌']] },
    '坤': { inner:[['乙','未'],['乙','巳'],['乙','卯']], outer:[['癸','丑'],['癸','亥'],['癸','酉']] },
    '震': { inner:[['庚','子'],['庚','寅'],['庚','辰']], outer:[['庚','午'],['庚','申'],['庚','戌']] },
    '巽': { inner:[['辛','丑'],['辛','亥'],['辛','酉']], outer:[['辛','未'],['辛','巳'],['辛','卯']] },
    '坎': { inner:[['戊','寅'],['戊','辰'],['戊','午']], outer:[['戊','申'],['戊','戌'],['戊','子']] },
    '离': { inner:[['己','卯'],['己','丑'],['己','亥']], outer:[['己','酉'],['己','未'],['己','巳']] },
    '艮': { inner:[['丙','辰'],['丙','午'],['丙','申']], outer:[['丙','戌'],['丙','子'],['丙','寅']] },
    '兑': { inner:[['丁','巳'],['丁','卯'],['丁','丑']], outer:[['丁','亥'],['丁','酉'],['丁','未']] }
  };

  // ===== 六亲判定 =====
  function getLiuQin(palaceWx, zhiWx) {
    if (palaceWx === zhiWx) return '兄弟';
    if (WUXING_SHENG[zhiWx] === palaceWx) return '父母'; // 他生我
    if (WUXING_SHENG[palaceWx] === zhiWx) return '子孙'; // 我生他
    if (WUXING_KE[zhiWx] === palaceWx) return '官鬼';    // 他克我
    if (WUXING_KE[palaceWx] === zhiWx) return '妻财';    // 我克他
    return '兄弟';
  }

  // ===== 六神 =====
  var LIU_SHEN = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
  function getLiuShenByRiGan(riGanIdx) {
    var start;
    if (riGanIdx === 0 || riGanIdx === 1) start = 0;       // 甲乙→青龙
    else if (riGanIdx === 2 || riGanIdx === 3) start = 1;  // 丙丁→朱雀
    else if (riGanIdx === 4) start = 2;                    // 戊→勾陈
    else if (riGanIdx === 5) start = 3;                    // 己→螣蛇
    else if (riGanIdx === 6 || riGanIdx === 7) start = 4;  // 庚辛→白虎
    else start = 5;                                        // 壬癸→玄武
    var arr = [];
    for (var i = 0; i < 6; i++) arr.push(LIU_SHEN[(start + i) % 6]);
    return arr; // [初爻,二爻,三爻,四爻,五爻,上爻]
  }

  // ===== 四柱干支 =====
  var BASE_DATE = new Date(1900, 0, 1);
  var BASE_RI_GAN = 0;   // 甲
  var BASE_RI_ZHI = 10;  // 戌
  function daysBetween(d1, d2) {
    var one = 86400000;
    return Math.floor((Date.UTC(d2.getFullYear(),d2.getMonth(),d2.getDate())
                     - Date.UTC(d1.getFullYear(),d1.getMonth(),d1.getDate())) / one);
  }
  // 月支：以节气为界（简化按公历交接日）
  var JIE_QI = [
    { m:1,  d:6,  z:1 },  // 小寒 丑月
    { m:2,  d:4,  z:2 },  // 立春 寅月
    { m:3,  d:6,  z:3 },  // 惊蛰 卯月
    { m:4,  d:5,  z:4 },  // 清明 辰月
    { m:5,  d:6,  z:5 },  // 立夏 巳月
    { m:6,  d:6,  z:6 },  // 芒种 午月
    { m:7,  d:7,  z:7 },  // 小暑 未月
    { m:8,  d:8,  z:8 },  // 立秋 申月
    { m:9,  d:8,  z:9 },  // 白露 酉月
    { m:10, d:8,  z:10 }, // 寒露 戌月
    { m:11, d:7,  z:11 }, // 立冬 亥月
    { m:12, d:7,  z:0 }   // 大雪 子月
  ];
  function getYueZhiIdx(date) {
    var m = date.getMonth()+1, d = date.getDate();
    for (var i = JIE_QI.length - 1; i >= 0; i--) {
      var j = JIE_QI[i];
      if (m > j.m || (m === j.m && d >= j.d)) return j.z;
    }
    return 1; // 默认丑月
  }

  function getNian(date) {
    var y = date.getFullYear();
    var m = date.getMonth()+1, d = date.getDate();
    if (m < 2 || (m === 2 && d < 4)) y -= 1;  // 立春前算上一年
    var off = y - 1984; // 1984=甲子
    var g = (off % 10 + 10) % 10;
    var z = (off % 12 + 12) % 12;
    return { gan:g, zhi:z, text:TIAN_GAN[g]+DI_ZHI[z], ganName:TIAN_GAN[g], zhiName:DI_ZHI[z] };
  }

  // 五虎遁：年干定寅月干
  var WU_HU = {0:2,1:4,2:6,3:8,4:0,5:2,6:4,7:6,8:8,9:0};
  function getYue(date, nianGanIdx) {
    var zhiIdx = getYueZhiIdx(date);
    var yinGan = WU_HU[nianGanIdx];
    var off = zhiIdx - 2;
    if (off < 0) off += 12;
    var g = (yinGan + off) % 10;
    return { gan:g, zhi:zhiIdx, text:TIAN_GAN[g]+DI_ZHI[zhiIdx], ganName:TIAN_GAN[g], zhiName:DI_ZHI[zhiIdx] };
  }

  function getRi(date) {
    var d = daysBetween(BASE_DATE, date);
    var g = (BASE_RI_GAN + d) % 10;
    var z = (BASE_RI_ZHI + d) % 12;
    if (g < 0) g += 10;
    if (z < 0) z += 12;
    return { gan:g, zhi:z, text:TIAN_GAN[g]+DI_ZHI[z], ganName:TIAN_GAN[g], zhiName:DI_ZHI[z] };
  }

  // 五鼠遁：日干定时干
  var WU_SHU = {0:0,1:2,2:4,3:6,4:8,5:0,6:2,7:4,8:6,9:8};
  function getShi(date, riGanIdx) {
    var h = date.getHours();
    var zhiIdx = h === 23 ? 0 : Math.floor((h + 1) / 2) % 12;
    var ziGan = WU_SHU[riGanIdx];
    var g = (ziGan + zhiIdx) % 10;
    return { gan:g, zhi:zhiIdx, text:TIAN_GAN[g]+DI_ZHI[zhiIdx], ganName:TIAN_GAN[g], zhiName:DI_ZHI[zhiIdx] };
  }

  // ===== 旬空 =====
  function getXunKong(riGan, riZhi) {
    var diff = riZhi - riGan;
    var xunShouZhi = diff < 0 ? (diff % 12 + 12) : (diff % 12); // 本旬首地支
    // 本旬最后两个地支即空亡
    var k1 = (xunShouZhi + 10) % 12, k2 = (xunShouZhi + 11) % 12;
    var xunShouGan = (riGan - (riZhi - xunShouZhi) % 10 + 100) % 10;
    return {
      xun: TIAN_GAN[xunShouGan] + DI_ZHI[xunShouZhi] + '旬',
      kong: [ DI_ZHI[k1], DI_ZHI[k2] ]
    };
  }

  // ===== 神煞 =====
  function getShenSha(siZhu) {
    var rz = siZhu.ri.zhiName, nz = siZhu.nian.zhiName, rg = siZhu.ri.gan;

    // 驿马 （三合冲位）
    var yiMa = ({ '寅':'申','午':'申','戌':'申','申':'寅','子':'寅','辰':'寅','亥':'巳','卯':'巳','未':'巳','巳':'亥','酉':'亥','丑':'亥' })[rz];
    // 桃花 （三合沐浴）
    var taoHua = ({ '寅':'卯','午':'卯','戌':'卯','申':'酉','子':'酉','辰':'酉','亥':'子','卯':'子','未':'子','巳':'午','酉':'午','丑':'午' })[rz];
    // 禄神
    var LU = ['寅','卯','巳','午','巳','午','申','酉','亥','子'];
    var luShen = LU[rg];
    // 天乙贵人 （甲戊庚牛羊 乙己鼠猴乡 丙丁猪鸡位 壬癸兔蛇藏 六辛逢马虎）
    var GUI = {0:['丑','未'],4:['丑','未'],6:['丑','未'],1:['子','申'],5:['子','申'],2:['亥','酉'],3:['亥','酉'],8:['卯','巳'],9:['卯','巳'],7:['午','寅']};
    var gr = GUI[rg] || ['',''];
    // 将星
    var JIANG = ({ '寅':'午','午':'午','戌':'午','申':'子','子':'子','辰':'子','亥':'卯','卯':'卯','未':'卯','巳':'酉','酉':'酉','丑':'酉' })[rz];
    // 华盖
    var HUA = ({ '寅':'戌','午':'戌','戌':'戌','申':'辰','子':'辰','辰':'辰','亥':'未','卯':'未','未':'未','巳':'丑','酉':'丑','丑':'丑' })[rz];
    // 羊刃
    var YR = ['卯','寅','午','巳','午','巳','酉','申','子','亥'];
    var yangRen = YR[rg];
    // 文昌
    var WC = ['巳','午','申','酉','申','酉','亥','子','寅','卯'];
    var wenChang = WC[rg];
    // 天医（月支前一）
    var tianYiZhi = (siZhu.yue.zhi + 11) % 12;
    // 灾煞 = 将星冲
    var chongDui = {'子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳'};
    var zaiSha = chongDui[JIANG] || '';
    // 劫煞
    var JIE = ({ '寅':'亥','午':'亥','戌':'亥','申':'巳','子':'巳','辰':'巳','亥':'申','卯':'申','未':'申','巳':'寅','酉':'寅','丑':'寅' })[rz];
    // 天喜：红鸾对宫；红鸾 = 年支+3
    var hongLuan = (siZhu.nian.zhi + 3) % 12;
    var tianXi = (hongLuan + 6) % 12;
    // 红艳
    var HY = {0:'午',1:'申',2:'寅',3:'未',4:'辰',5:'辰',6:'戌',7:'酉',8:'子',9:'酉'};
    // 金舆
    var JY = {0:'辰',1:'巳',2:'未',3:'申',4:'未',5:'申',6:'戌',7:'亥',8:'寅',9:'卯'};

    return [
      { name:'驿马', value: yiMa },
      { name:'桃花', value: taoHua },
      { name:'禄神', value: luShen },
      { name:'贵人', value: gr[0] + gr[1] },
      { name:'将星', value: JIANG },
      { name:'华盖', value: HUA },
      { name:'羊刃', value: yangRen },
      { name:'文昌', value: wenChang },
      { name:'天医', value: DI_ZHI[tianYiZhi] },
      { name:'灾煞', value: zaiSha },
      { name:'劫煞', value: JIE },
      { name:'红艳', value: HY[rg] || '' },
      { name:'金舆', value: JY[rg] || '' },
      { name:'天喜', value: DI_ZHI[tianXi] },
      { name:'谋星', value: '未' },
      { name:'香闺', value: taoHua },
      { name:'床帐', value: taoHua==='卯'?'酉':(taoHua==='酉'?'卯':(taoHua==='午'?'子':'午')) }
    ];
  }

  // ===== 旺相休囚死 =====
  function getSeasonWuxing(yueZhiName) {
    if (yueZhiName === '寅' || yueZhiName === '卯') return '木';
    if (yueZhiName === '巳' || yueZhiName === '午') return '火';
    if (yueZhiName === '申' || yueZhiName === '酉') return '金';
    if (yueZhiName === '亥' || yueZhiName === '子') return '水';
    return '土';
  }
  function getStrengthBySeason(moonWx, targetWx) {
    if (moonWx === targetWx) return '旺';
    if (WUXING_SHENG[moonWx] === targetWx) return '相'; // 令生我（实应为"我生令=相"）—— 此处更正按古法：
    // 古法：当令者旺，令生者相，生令者休，克令者囚，令克者死
    // 重新实现：
  }
  function getStrength(moonWx, targetWx) {
    if (targetWx === moonWx) return '旺';                             // 当令者旺
    if (WUXING_SHENG[moonWx] === targetWx) return '相';               // 令生者相 (令→target)
    if (WUXING_SHENG[targetWx] === moonWx) return '休';               // 生令者休 (target→令)
    if (WUXING_KE[targetWx] === moonWx) return '囚';                  // 克令者囚 (target→X→令)
    if (WUXING_KE[moonWx] === targetWx) return '死';                  // 令克者死 (令→X→target)
    return '平';
  }

  function findTrigramByBinary(b) {
    return ({'111':'乾','110':'兑','101':'离','100':'震','011':'巽','010':'坎','001':'艮','000':'坤'})[b] || '乾';
  }

  function findHexDataByTrigrams(upper, lower) {
    if (typeof window === 'undefined' || !window.hexagramsData) return null;
    var a = window.hexagramsData;
    for (var i = 0; i < a.length; i++) {
      if (a[i].upperTrigram === upper && a[i].lowerTrigram === lower) return a[i];
    }
    return null;
  }

  // ===== 装卦主函数 =====
  function installHexagram(hexUpperName, hexLowerName, lines, nowDate) {
    nowDate = nowDate || new Date();

    // 1) 四柱
    var nian = getNian(nowDate);
    var yue  = getYue(nowDate, nian.gan);
    var ri   = getRi(nowDate);
    var shi  = getShi(nowDate, ri.gan);
    var siZhu = { nian:nian, yue:yue, ri:ri, shi:shi };

    // 2) 旬空
    var xunKong = getXunKong(ri.gan, ri.zhi);

    // 3) 卦宫 + 世应
    var key = hexUpperName + hexLowerName;
    var pal = PALACE_MAP[key] || { palace:'未知宫', palaceWuxing:'土', shiPos:5, yingPos:2 };

    // 4) 纳甲/六亲/世应/旺相/空亡
    var innerTrigram = hexLowerName;
    var outerTrigram = hexUpperName;
    var palWx = pal.palaceWuxing;
    var moonWx = getSeasonWuxing(yue.zhiName);

    var chongMap = {'子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳'};
    var heMap    = {'子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午'};

    var installed = [];
    for (var p = 0; p < 6; p++) {
      var ln = lines[p] || { isYang:true, isChanging:false };
      var najia = p < 3
        ? NAJIA[innerTrigram].inner[p]
        : NAJIA[outerTrigram].outer[p - 3];
      var gt = najia[0], zt = najia[1];
      var zwx = ZHI_WUXING[zt];
      var qin = getLiuQin(palWx, zwx);
      var strength = getStrength(moonWx, zwx);
      installed[p] = {
        pos: p,
        posName: ['初','二','三','四','五','上'][p] + '爻',
        isYang: ln.isYang,
        isChanging: ln.isChanging,
        gan: gt, zhi: zt, ganZhi: gt + zt,
        zhiWuxing: zwx,
        ganWuxing: GAN_WUXING[gt],
        liuQin: qin,
        isShi: p === pal.shiPos,
        isYing: p === pal.yingPos,
        strength: strength,
        isKong: xunKong.kong.indexOf(zt) !== -1,
        yueChong: chongMap[zt] === yue.zhiName,
        yueHe:    heMap[zt]    === yue.zhiName,
        riChong:  chongMap[zt] === ri.zhiName,
        riHe:     heMap[zt]    === ri.zhiName,
        cangGan: ZHI_CANG_GAN[zt]
      };
    }

    // 5) 变卦装卦
    var changedLines = null;
    var changedMeta = null;
    var hasChange = lines.some(function (l) { return l.isChanging; });
    var changedFullName = '';
    if (hasChange) {
      var bins = lines.map(function (l) {
        return l.isChanging ? (l.isYang ? '0' : '1') : (l.isYang ? '1' : '0');
      }).join('');
      var cLower = findTrigramByBinary(bins.substring(0,3));
      var cUpper = findTrigramByBinary(bins.substring(3,6));
      var cKey = cUpper + cLower;
      var cPal = PALACE_MAP[cKey] || { palace:'未知宫', palaceWuxing:'土', shiPos:5, yingPos:2 };
      var cPalWx = cPal.palaceWuxing;

      var cLines = lines.map(function (l) {
        return { isYang: l.isChanging ? !l.isYang : l.isYang, isChanging: false };
      });
      changedLines = [];
      for (var q = 0; q < 6; q++) {
        var najia2 = q < 3 ? NAJIA[cLower].inner[q] : NAJIA[cUpper].outer[q-3];
        var gt2 = najia2[0], zt2 = najia2[1];
        changedLines.push({
          pos: q,
          isYang: cLines[q].isYang,
          gan: gt2, zhi: zt2, ganZhi: gt2+zt2,
          zhiWuxing: ZHI_WUXING[zt2],
          liuQin: getLiuQin(cPalWx, ZHI_WUXING[zt2]),
          isShi: q === cPal.shiPos,
          isYing: q === cPal.yingPos,
          isKong: xunKong.kong.indexOf(zt2) !== -1
        });
      }
      var cData = findHexDataByTrigrams(cUpper, cLower);
      changedFullName = cData ? cData.fullName : (cUpper + cLower);
      changedMeta = {
        palace: cPal.palace, palaceWuxing: cPalWx,
        upperName: cUpper, lowerName: cLower,
        liuChong: !!cPal.liuChong, liuHe: !!cPal.liuHe,
        fullName: changedFullName
      };
    }

    // 6) 六神
    var liuShen = getLiuShenByRiGan(ri.gan);

    // 7) 神煞
    var shenSha = getShenSha(siZhu);

    return {
      siZhu: siZhu,
      xunKong: xunKong,
      palace: pal.palace,
      palaceWuxing: palWx,
      shiPos: pal.shiPos,
      yingPos: pal.yingPos,
      liuChong: !!pal.liuChong,
      liuHe: !!pal.liuHe,
      mainLines: installed,
      changedLines: changedLines,
      changedMeta: changedMeta,
      liuShen: liuShen,
      shenSha: shenSha,
      seasonWuxing: moonWx,
      dateInfo: {
        solar: nowDate.getFullYear() + '-' + pad(nowDate.getMonth()+1) + '-' + pad(nowDate.getDate()) +
               ' ' + pad(nowDate.getHours()) + ':' + pad(nowDate.getMinutes()),
        lunarHint: getLunarHint(nowDate, nian, yue)
      },
      // 供 AI / 展示使用的简要摘要
      summary: buildSummary(hexUpperName, hexLowerName, pal, installed, changedMeta, hasChange, siZhu, xunKong,
        nowDate.getFullYear() + '-' + pad(nowDate.getMonth()+1) + '-' + pad(nowDate.getDate()) +
        ' ' + pad(nowDate.getHours()) + ':' + pad(nowDate.getMinutes()))
    };
  }

  function pad(n) { return n < 10 ? '0'+n : ''+n; }
  function getLunarHint(date, nian, yue) {
    var chiYue = {'寅':'正月','卯':'二月','辰':'三月','巳':'四月','午':'五月','未':'六月',
                  '申':'七月','酉':'八月','戌':'九月','亥':'十月','子':'冬月','丑':'腊月'};
    return nian.text + '年 ' + (chiYue[yue.zhiName] || '');
  }

  // 生成给 AI 用的文本摘要（断卦所需核心信息）
  function buildSummary(upperName, lowerName, pal, installed, changedMeta, hasChange, siZhu, xunKong, solarText) {
    var mainData = findHexDataByTrigrams(upperName, lowerName);
    var s = '';
    s += '【排盘时间】西历：' + (solarText || '') + '\n';
    s += '【四柱干支】年柱:' + siZhu.nian.text + '　月柱:' + siZhu.yue.text + '　日柱:' + siZhu.ri.text + '　时柱:' + siZhu.shi.text + '\n';
    s += '【月日建】月建为' + siZhu.yue.zhiName + '（' + getSeasonWuxing(siZhu.yue.zhiName) + '令），日辰为' + siZhu.ri.zhiName + '，旬空：' + xunKong.kong.join('') + '（' + xunKong.xun + '）\n\n';
    s += '【本卦】' + (mainData ? mainData.fullName : upperName+lowerName) + '　' + pal.palace + ' 属' + pal.palaceWuxing + '　';
    s += (pal.liuChong ? '六冲卦　' : '') + (pal.liuHe ? '六合卦　' : '') + '世爻在' + (pal.shiPos+1) + '爻，应爻在' + (pal.yingPos+1) + '爻\n';

    s += '【本卦六爻全象】（从上爻→初爻读）\n';
    for (var p = 5; p >= 0; p--) {
      var L = installed[p];
      var lineSym = L.isYang ? '━━━━━' : '━　 ━━';
      if (L.isChanging) lineSym += L.isYang ? ' ○ 阳动' : ' × 阴动';
      s += '  ' + lineSym + '　' + L.ganZhi + ' ' + padWuxing(L.zhiWuxing) + ' ' + padQin(L.liuQin);
      if (L.isShi) s += ' 世';
      if (L.isYing) s += ' 应';
      s += ' ' + L.strength;
      if (L.isKong) s += ' 空亡';
      if (L.yueChong) s += ' 月破';
      if (L.riChong) s += ' 日冲';
      if (L.yueHe) s += ' 月合';
      if (L.riHe) s += ' 日合';
      s += '\n';
    }

    if (hasChange && changedMeta) {
      s += '\n【变卦】' + changedMeta.fullName + '　' + changedMeta.palace + ' 属' + changedMeta.palaceWuxing + '　';
      s += (changedMeta.liuChong ? '六冲卦　' : '') + (changedMeta.liuHe ? '六合卦　' : '') + '\n';
    }
    return s;
  }

  // 补全方法：让 summary 能访问到 dateInfo
  function siZhu_dateInfo_solar_factory() {
    // 使用时由调用方补入
  }

  function padWuxing(w) { return w ? w + '' : ''; }
  function padQin(q) { return q ? q + '' : ''; }

  // 为 summary 补日期字符串（因为 buildSummary 中 siZhu 没有 dateInfo_solar 方法）
  // 解决方式：在调用 installHexagram 返回之后，再调用 buildSummaryText()，可传入 dateInfo.solar
  function buildSummaryText(hexUpperName, hexLowerName, pal, installed, changedMeta, hasChange, siZhu, xunKong, solarText) {
    var mainData = findHexDataByTrigrams(hexUpperName, hexLowerName);
    var s = '';
    s += '【排盘时间】西历：' + solarText + '\n';
    s += '【四柱干支】年柱:' + siZhu.nian.text + '  月柱:' + siZhu.yue.text + '  日柱:' + siZhu.ri.text + '  时柱:' + siZhu.shi.text + '\n';
    s += '【月日建】月建' + siZhu.yue.zhiName + '（' + getSeasonWuxing(siZhu.yue.zhiName) + '令），日辰' + siZhu.ri.zhiName + '；旬空：' + xunKong.kong.join('、') + '（' + xunKong.xun + '）\n\n';
    s += '【本卦】' + (mainData ? mainData.fullName : upperNameText(hexUpperName, hexLowerName)) + '（' + pal.palace + '，属' + pal.palaceWuxing + '）';
    if (pal.liuChong) s += ' 六冲卦';
    if (pal.liuHe) s += ' 六合卦';
    s += '；世爻在第' + (pal.shiPos+1) + '爻，应爻在第' + (pal.yingPos+1) + '爻\n';

    s += '\n【本卦六爻全象】（按传统从上往下列）\n';
    for (var p = 5; p >= 0; p--) {
      var L = installed[p];
      var parts = [];
      parts.push('第' + (p+1) + '爻 ' + L.posName);
      parts.push(L.isYang ? '阳爻' : '阴爻');
      if (L.isChanging) parts.push((L.isYang ? '老阳○发动' : '老阴×发动') + ' → ' + (L.isYang ? '变阴' : '变阳'));
      parts.push('纳甲：' + L.ganZhi + '（支' + L.zhiWuxing + '）');
      parts.push('六亲：' + L.liuQin);
      if (L.isShi) parts.push('【世】');
      if (L.isYing) parts.push('【应】');
      parts.push('月建状态：' + L.strength);
      var extra = [];
      if (L.isKong) extra.push('旬空');
      if (L.yueChong) extra.push('月破');
      if (L.riChong) extra.push('日冲' + (L.strength === '旺' ? '（暗动）' : '（日破）'));
      if (L.yueHe) extra.push('月合');
      if (L.riHe) extra.push('日合');
      if (L.cangGan && L.cangGan.length) {
        var cg = L.cangGan.map(function (g) {
          return g + '(' + GAN_WUXING[g] + ',' + getLiuQin(pal.palaceWuxing, GAN_WUXING[g]) + ')';
        }).join(' ');
        parts.push('藏干含：' + cg);
      }
      if (extra.length) parts.push('状态：' + extra.join('、'));
      s += '  · ' + parts.join('；') + '\n';
    }

    if (hasChange && changedMeta) {
      s += '\n【变卦】' + changedMeta.fullName + '（' + changedMeta.palace + '，属' + changedMeta.palaceWuxing + '）';
      if (changedMeta.liuChong) s += ' 六冲卦';
      if (changedMeta.liuHe) s += ' 六合卦';
      s += '\n';
    }
    return s;
  }

  function upperNameText(u,l) { return u+l; }

  // ===== 对外接口 =====
  window.LiuyaoEngine = {
    TIAN_GAN: TIAN_GAN, DI_ZHI: DI_ZHI,
    ZHI_WUXING: ZHI_WUXING, GAN_WUXING: GAN_WUXING,
    WUXING_SHENG: WUXING_SHENG, WUXING_KE: WUXING_KE,
    PALACE_MAP: PALACE_MAP,
    NAJIA: NAJIA,
    getLiuQin: getLiuQin,
    getStrength: getStrength,
    getSeasonWuxing: getSeasonWuxing,
    installHexagram: installHexagram,
    buildSummaryText: buildSummaryText
  };
})();

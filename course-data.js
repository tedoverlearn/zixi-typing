/* 前三节的顺序和原文与初版一致，以便恢复已有进度。 */
(function (root) {
  'use strict';
  const units = [
    {
      title: '输入入门', description: '从单字输入到一个完整句子。',
      lessons: [
        { title: '常用汉字', tip: '用熟悉的输入法逐字确认。先观察候选字，再选中目标字。', speed: 20, items: ['你我他她们好的人大小多少上下左右天地日月山水'] },
        { title: '日常词语', tip: '试着一次选出一个词。词语之间直接接着输。', speed: 25, items: ['你好今天朋友学习生活快乐时间工作中文世界'] },
        { title: '短句练习', tip: '留意断句位置，跟着原文输入中文逗号和句号。', speed: 25, items: ['今天的天气很好。我想每天练习中文打字，让每一次输入都更准确。慢慢来，也是一种进步。'] },
        { title: '入门复习', tip: '先看完一句再输入，练习从字词过渡到整句。', speed: 30, items: ['今天的阳光很好，我和朋友约好去散步。', '回家的时候，我顺路买了水果和面包。'] }
      ]
    },
    {
      title: '连打词语', description: '逐步增加词语长度，熟悉连续选词。',
      lessons: [
        { title: '生活里的双字词', tip: '按词输入。画面里的间隔是用来分词的。', speed: 30, words: true, items: ['早晨', '窗户', '天气', '阳光', '房间', '厨房', '早餐', '牛奶', '面包', '水果', '出门', '钥匙', '街道', '公交', '邻居', '回家'] },
        { title: '常用三字词', tip: '遇到一时选不准的词，可以分两次输入。', speed: 30, words: true, items: ['图书馆', '电影院', '自行车', '办公室', '打印机', '文件夹', '充电器', '笔记本', '工作日', '目的地', '收银台', '服务员'] },
        { title: '四字短语', tip: '按短语的含义读一遍，再连贯输入。', speed: 35, words: true, items: ['提前准备', '按时出发', '及时回复', '整理资料', '确认信息', '保存文件', '耐心等待', '交换意见', '熟能生巧', '循序渐进'] },
        { title: '词语综合练习', tip: '根据词长调整输入节奏，注意每一组的词语边界。', speed: 35, words: true, items: ['安排', '工作日', '完成任务', '讨论', '会议室', '交流想法', '进度', '笔记本', '记录生活', '选择', '公交车', '绿色出行', '检查', '文件夹', '确认时间'] }
      ]
    },
    {
      title: '句子与标点', description: '练习整句输入和常用中文标点。',
      lessons: [
        { title: '逗号和句号', tip: '逗号表示句中停顿，句号结束一句，两个都要输入。', speed: 30, items: ['下雨以后，路边的树叶变得格外干净。', '午饭吃完了，我们想去楼下走一走。', '今天的事情都办完了，可以早点回家。'] },
        { title: '问号和感叹号', tip: '读到疑问或感叹时，看看句尾需要哪个标点。', speed: 30, items: ['我们明天在图书馆的门口见面，好吗？', '你知道从这里到地铁站要走多久吗？', '原来这条小路也能通到河边，太好了！'] },
        { title: '顿号与引号', tip: '注意并列词语之间的顿号，以及成对出现的引号。', speed: 35, items: ['出门前，我把钥匙、雨伞和水杯放进背包。', '桌上有苹果、橘子、香蕉和几块饼干。', '老师笑着说：“把步骤想清楚，再动手写。”'] },
        { title: '长句综合练习', tip: '可以在逗号处停一下，先核对前半句再继续。', speed: 35, items: ['如果明天下午天气晴朗，我们带上准备好的食物，一起去附近的公园野餐。', '晚饭过后，一家人沿着河边慢慢散步，聊聊今天发生的趣事，心情轻松起来。'] }
      ]
    },
    {
      title: '场景篇章', description: '把输入能力用在通知、邮件和日常记录里。',
      lessons: [
        { title: '社区通知', tip: '通知里常有地点、时间和行动要求，输入时逐项核对。', speed: 35, items: ['本周六上午，社区将在活动室举行旧物交换活动。请把想交换的物品提前整理好，入场时在门口登记。', '活动结束后，请将剩余物品带回，并一起把桌椅归位。'] },
        { title: '工作邮件', tip: '先读清请求和期限，再按原文输入。', speed: 40, items: ['大家好，会议资料已经整理完毕。请在周四下班前阅读附件，并把需要讨论的问题发给我。', '我会将大家的意见汇总，留到周五的会议上逐一确认。'] },
        { title: '日常见闻', tip: '按意思读完短句后再打，尽量保持连贯。', speed: 40, items: ['傍晚，我沿着河边往家走。刚下过雨，空气里带着草木的清香。', '桥下有人收起钓竿，远处的路灯陆续亮了起来。我在桥上停了一会儿，等晚风吹散白天的疲惫。'] },
        { title: '篇章综合练习', tip: '把准确输入放在第一位。完成后试着重练一次，对比速度和准确率。', speed: 45, items: ['清晨的菜市场已经热闹起来。摊主把新鲜蔬菜整齐摆好，顾客提着菜篮在摊位之间慢慢挑选。', '我买了一把青菜和两个番茄，又到街角买了热豆浆。回家路上，阳光透过树叶，在人行道上留下细碎的光斑。'] }
      ]
    }
  ];

  let index = 0;
  const lessons = units.flatMap((unit, unitIndex) => unit.lessons.map(lesson => ({
    ...lesson, unitIndex, index: index++, text: lesson.items.join('')
  })));

  function rating(score, lesson) {
    if (!Number.isFinite(score?.accuracy) || !Number.isFinite(score.speed)) return 0;
    if (score.accuracy >= 98 && score.speed >= lesson.speed) return 5;
    if (score.accuracy >= 95) return 4;
    if (score.accuracy >= 90) return 3;
    if (score.accuracy >= 85) return 2;
    return 1;
  }

  function betterScore(score, best, lesson) {
    const difference = rating(score, lesson) - rating(best, lesson);
    if (difference !== 0) return difference > 0;
    if (score.accuracy !== best.accuracy) return score.accuracy > best.accuracy;
    return score.speed > best.speed;
  }

  const api = { units, lessons, rating, betterScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CourseData = api;
})(globalThis);

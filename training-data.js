(function (root) {
  'use strict';

  const keyRows = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm'];
  const fingerGroups = [
    ['qaz', '左手小指'], ['wsx', '左手无名指'], ['edc', '左手中指'], ['rfvtgb', '左手食指'],
    ['yhnujm', '右手食指'], ['ik', '右手中指'], ['ol', '右手无名指'], ['p;', '右手小指']
  ];
  const fingers = Object.fromEntries(fingerGroups.flatMap(([keys, finger]) => Array.from(keys, key => [key, finger])));
  const keyLessons = [
    { title: 'F、J 定位', tip: '用两根食指摸到 F 和 J 的凸起。眼睛看屏幕，先轻按，再慢慢交替。', items: ['ffjj', 'jjff', 'fjfj', 'jfjf', 'ffjf', 'jjfj', 'fjff', 'jfjj'] },
    { title: '中排基准键', tip: '左手放在 ASDF，右手放在 JKL;。按 G 和 H 后，食指回到 F 和 J。', items: ['asdf', 'jkl;', 'fdsa', ';lkj', 'fghj', 'jhgf', 'alal', 'sksk', 'dldl', 'fjjf'] },
    { title: '上排字母', tip: '从中排伸到上排，按完就归位。一组打慢一点，尽量不低头找键。', items: ['aqsw', 'defr', 'ftgy', 'hujk', 'kilj', 'lop;', 'qwer', 'tyui', 'opop', 'ruru'] },
    { title: '下排字母', tip: '手指向下探键，按完回到中排。练习时放松手腕。', items: ['azsx', 'dcfv', 'fgbh', 'hnhn', 'jmjm', 'zxcv', 'bnmn', 'cfvf', 'bgbg', 'mjnj'] },
    { title: '三排混合', tip: '先打准再提速。感觉稳定后，可以关掉屏幕上的按键提示。', items: ['qazw', 'sxed', 'crfv', 'tgby', 'hnuj', 'miko', 'lpqj', 'awvx', 'kzed', 'sfnm', 'qjrp', 'bgui'] }
  ];

  const chinaDate = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai'
  });

  function dayKey(time = Date.now()) {
    const parts = Object.fromEntries(chinaDate.formatToParts(time).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function validDay(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day)) return false;
    const time = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day;
  }

  function dailyItems(day, pool) {
    let seed = 2166136261;
    for (const char of day) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    const items = [...pool];
    for (let i = 0; i < 3; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const index = i + seed % (items.length - i);
      [items[i], items[index]] = [items[index], items[i]];
    }
    return items.slice(0, 3);
  }

  function challengeStreak(scores, today) {
    let time = Date.parse(`${today}T00:00:00Z`);
    const previousDay = () => new Date(time).toISOString().slice(0, 10);
    if (!scores[today]) time -= 86400000;
    let count = 0;
    while (scores[previousDay()]) {
      count++;
      time -= 86400000;
    }
    return count;
  }

  const isReviewItem = item => typeof item === 'string' && /^\p{Script=Han}{1,4}$/u.test(item);

  function rankedReview(queue) {
    return Object.entries(queue || {}).filter(([item, value]) => isReviewItem(item) && Number.isFinite(value?.count) && value.count > 0)
      .sort((a, b) => b[1].count - a[1].count || b[1].at - a[1].at);
  }

  function updateReview(queue, misses, practicedItems, now) {
    const next = { ...queue };
    for (const item of practicedItems) {
      if (!misses.has(item)) delete next[item];
    }
    for (const item of misses) {
      next[item] = { count: (Number.isFinite(next[item]?.count) ? next[item].count : 0) + 1, at: now };
    }
    return Object.fromEntries(rankedReview(next).slice(0, 80));
  }

  const api = { keyRows, fingers, keyLessons, dayKey, validDay, dailyItems, challengeStreak, isReviewItem, rankedReview, updateReview };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrainingData = api;
})(globalThis);

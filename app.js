(() => {
  'use strict';
  const { levels, modes, characters, sentences, generate } = window.PracticeData;
  const { units, lessons, rating, betterScore } = window.CourseData;
  const { keyRows, fingers, keyLessons, dayKey, validDay, dailyItems, challengeStreak, isReviewItem, rankedReview, updateReview } = window.TrainingData;
  const $ = id => document.getElementById(id);
  const input = $('typing');
  const introKey = 'zixi-preview-progress-v1';
  const randomKey = 'zixi-random-progress-v1';
  const settingsKey = 'zixi-random-settings-v1';
  const sessionKey = 'zixi-practice-session-v1';
  function readStore(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { $('save-note').textContent = '浏览器存储不可用，本次仍可练习。'; return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { $('save-note').textContent = '本次仍可练习，但浏览器未能保存记录。'; }
  }
  let records = readStore(introKey, {});
  if (!records || typeof records !== 'object' || Array.isArray(records)) records = {};
  let randomRecord = readStore(randomKey, {});
  if (!randomRecord || !Number.isSafeInteger(randomRecord.count) || randomRecord.count < 0) randomRecord = { count: 0 };
  const saved = readStore(settingsKey, {});
  function readSettings(value) {
    return {
      mode: Object.hasOwn(modes, value?.mode) ? value.mode : 'words',
      level: levels.some(level => level.id === value?.level) ? value.level : 'easy',
      size: [0, 1, 2].includes(value?.size) ? value.size : 0
    };
  }
  let settings = readSettings(saved);
  let sessionData = readStore(sessionKey, {});
  if (!sessionData || typeof sessionData !== 'object' || Array.isArray(sessionData)) sessionData = {};
  let attemptId;
  let section = 'random', selected = 0, exercise, targetChars = [];
  let keyStage = 0, lastTraining = 'keyboard', missedItems = new Set();
  let keyHints = readStore('zixi-key-hints-v1', true) !== false;
  let previous = '', composing = false, completed = false, paused = false, pauseRequested = false;
  let startedAt = null, elapsed = 0, attempts = 0, hits = 0, pendingAction = null;
  const duration = () => elapsed + (startedAt === null ? 0 : performance.now() - startedAt);
  const accuracy = () => attempts ? Math.round(hits / attempts * 100) : 0;
  const correctCount = () => Array.from(previous).filter((char, i) => char === exercise.chars[i]).length;
  const speed = () => duration() > 0 ? Math.round(correctCount() / Math.max(duration() / 60000, 1 / 60)) : 0;
  const active = () => !completed && (startedAt !== null || elapsed > 0 || previous.length > 0 || composing);
  const durationLabel = ms => {
    const seconds = Math.floor(ms / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const firstError = () => Array.from(previous).findIndex((char, i) => char !== exercise.chars[i]);
  const courseStars = lesson => rating(records[lesson.index], lesson);
  const recommendedLesson = (options = lessons) => options.find(lesson => !courseStars(lesson));
  const trainingModes = {
    keyboard: { title: '键位盲打', subtitle: '基准键与指法', icon: '键' },
    review: { title: '错字复练', subtitle: '集中复习易错字词', icon: '错' },
    daily: { title: '每日挑战', subtitle: '每天三句固定题', icon: '日' }
  };
  const speedUnit = () => section === 'keyboard' ? '字符/分钟' : '字/分钟';
  const buttonContent = (button, icon, title, detail) => {
    const marker = document.createElement('span');
    marker.className = 'lesson-index';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = icon;
    const wording = document.createElement('span');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const meta = document.createElement('small');
    meta.textContent = detail;
    wording.append(heading, meta);
    button.append(marker, wording);
  };

  const keyboardKeys = new Map();
  for (const row of keyRows) {
    const line = document.createElement('div');
    line.className = 'keymap-row';
    for (const key of row) {
      const label = document.createElement('kbd');
      label.textContent = key.toUpperCase();
      label.classList.toggle('home-key', key === 'f' || key === 'j');
      keyboardKeys.set(key, label);
      line.append(label);
    }
    $('keymap').append(line);
  }
  keyLessons.forEach((lesson, index) => $('key-stage').add(new Option(`${index + 1}. ${lesson.title}`, index)));

  function renderTraining() {
    const keyboard = section === 'keyboard';
    const review = section === 'review';
    $('key-settings').hidden = !keyboard;
    $('key-stage').value = keyStage;
    $('key-hints-toggle').setAttribute('aria-pressed', String(keyHints));
    $('key-guide').hidden = !keyboard || !keyHints;
    $('training-summary').hidden = false;
    $('review-seed').hidden = true;
    if (keyboard) {
      $('training-status').textContent = `QWERTY 键位 · 第 ${keyStage + 1} / ${keyLessons.length} 阶段`;
      $('training-detail').textContent = keyLessons[keyStage].tip;
    } else if (review) {
      const count = rankedReview(sessionData.review).length;
      const empty = !exercise.items.length;
      $('training-status').textContent = count ? `待复练 ${count} 项` : '错字本暂无待复练字词';
      $('training-detail').textContent = empty ? '完成一次中文练习后，输错过的字词会记在这里。'
        : '优先练出错较多的字词。在这里一次打对的字词会移出待复练列表。';
      $('review-seed').hidden = !empty;
    } else {
      const scores = sessionData.dailyScores || {};
      const best = scores[exercise.day];
      const streak = challengeStreak(scores, dayKey());
      $('training-status').textContent = `${exercise.day} · ${streak ? `连续完成 ${streak} 天` : '等待首次挑战'}`;
      $('training-detail').textContent = best ? `当日最佳 ${best.speed} 字/分钟，准确率 ${best.accuracy}%。可重复挑战。`
        : '每天北京时间零点换题，同一天题目相同。成绩保存在本机。';
    }
  }

  function renderCoursePath() {
    const unitIndex = lessons[selected].unitIndex;
    $('unit-description').textContent = units[unitIndex].description;
    $('units').replaceChildren(...units.map((unit, index) => {
      const options = lessons.filter(lesson => lesson.unitIndex === index);
      const button = document.createElement('button');
      button.className = 'unit-button';
      button.setAttribute('aria-pressed', String(index === unitIndex));
      const title = document.createElement('strong');
      title.textContent = unit.title;
      const progress = document.createElement('small');
      progress.textContent = `${options.filter(courseStars).length} / ${options.length} 节`;
      button.append(title, progress);
      button.addEventListener('click', () => {
        if (index !== unitIndex) requestChange(() => loadIntro((recommendedLesson(options) || options[0]).index));
      });
      return button;
    }));
    const next = recommendedLesson();
    $('continue-course').textContent = next?.index === selected ? '开始本课' : next ? `继续课程 · 第 ${next.index + 1} 节` : '从头复习';
    const lesson = lessons[selected];
    $('lesson-tip').textContent = lesson.tip;
    $('lesson-goal').textContent = `五星目标：准确率 98%，速度 ${lesson.speed} 字/分钟`;
    const best = records[selected];
    const stars = courseStars(lesson);
    $('lesson-best').textContent = stars ? `最佳 ${stars} 星 · ${best.speed} 字/分钟 · 准确率 ${best.accuracy}%` : '此课还没有成绩';
  }

  function updateSession(update) {
    sessionData = update(readStore(sessionKey, sessionData) || {});
    writeStore(sessionKey, sessionData);
  }

  function saveDraft() {
    if (!active()) return;
    const draft = {
      id: attemptId, section, selected, settings, items: exercise.items,
      text: previous, elapsed: duration(), attempts, hits, keyStage, day: exercise.day, misses: [...missedItems]
    };
    updateSession(data => ({ ...data, draft }));
  }

  function discardDraft() {
    if (attemptId && active()) {
      updateSession(data => data.draft?.id === attemptId ? { ...data, draft: null } : data);
    }
  }

  function renderNavigation() {
    const random = section === 'random';
    const intro = section === 'intro';
    const special = !random && !intro;
    for (const [id, current] of [['random-tab', random], ['intro-tab', intro], ['training-tab', special]]) {
      $(id).classList.toggle('nav-current', current);
      $(id).setAttribute('aria-pressed', String(current));
    }
    $('section-name').textContent = random ? '随机练习' : intro ? '系统课程' : '专项训练';
    $('section-description').textContent = random ? '选一种练习，用自己的中文输入法跟打。'
      : intro ? '从字词到篇章，按顺序练习，也可以直接选你想练的课。' : '练准键位、复习易错字词，或完成今天的挑战。';
    $('random-settings').hidden = !random;
    $('course-path').hidden = !intro;
    $('course-guidance').hidden = !intro;
    $('training-tools').hidden = !special;
    $('key-guide').hidden = true;
    $('practice').hidden = !exercise.chars.length;
    $('practice').classList.toggle('key-practice', section === 'keyboard');
    $('lessons').classList.toggle('course-lessons', intro);
    if (intro) renderCoursePath();
    if (special) renderTraining();
    const options = intro ? lessons.filter(lesson => lesson.unitIndex === lessons[selected].unitIndex)
      : Object.entries(random ? modes : trainingModes).map(([id, mode]) => ({ ...mode, id }));
    $('lessons').replaceChildren(...options.map((option, i) => {
      const button = document.createElement('button');
      const current = intro ? option.index === selected : option.id === (random ? settings.mode : section);
      button.className = 'lesson' + (current ? ' active' : '');
      button.setAttribute('aria-pressed', String(current));
      const stars = intro ? courseStars(option) : 0;
      const detail = intro ? (stars ? `最佳 ${stars} / 5 星` : '待练习') : option.subtitle;
      const icon = intro ? option.index + 1 : random ? ['词', '字', '句'][i] : option.icon;
      buttonContent(button, icon, option.title, detail);
      button.addEventListener('click', () => {
        if (current) return;
        requestChange(() => {
          if (intro) loadIntro(option.index);
          else if (random) loadRandom({ ...settings, mode: option.id });
          else loadTraining(option.id);
        });
      });
      return button;
    }));
    const count = lessons.filter(courseStars).length;
    $('course-count').textContent = `${count} / ${lessons.length}`;
    $('course-progress').max = lessons.length;
    $('course-progress').value = count;
    $('random-count').replaceChildren(document.createTextNode(`${randomRecord.count} `), Object.assign(document.createElement('small'), { textContent: '组' }));
    const last = randomRecord.last;
    if (last && Number.isFinite(last.speed) && Number.isFinite(last.accuracy)) $('last-score').textContent = `最近一组：${last.speed} 字/分钟，准确率 ${last.accuracy}%。`;
    if (random) syncSettings();
  }
  function syncSettings() {
    $('level').value = settings.level;
    $('length').value = String(settings.size);
    $('level-field').hidden = settings.mode !== 'words';
    [...$('length').options].forEach((option, i) => {
      option.textContent = `${['轻练', '标准', '加练'][i]} · ${modes[settings.mode].counts[i]} ${modes[settings.mode].unit}`;
    });
    $('mode-description').textContent = settings.mode === 'words'
      ? levels.find(level => level.id === settings.level).description
      : settings.mode === 'characters' ? '从精选常用字中抽取，先练准确，再提高速度。' : '每句 10–30 个汉字（不含标点），随机混合长短句；请连同中文标点一起输入，无需换行。';
  }
  function renderStats() {
    $('speed').textContent = completed || duration() >= 3000 ? speed() : '—';
    $('speed-unit').textContent = speedUnit();
    $('accuracy').textContent = attempts ? accuracy() : '—';
    $('accuracy-unit').textContent = attempts ? '%' : '';
    $('time').textContent = durationLabel(duration());
    $('typed-count').textContent = Array.from(previous).length;
  }
  function renderExercise() {
    targetChars = [];
    $('target').replaceChildren(...exercise.items.map(item => {
      const token = document.createElement('span');
      if (exercise.grouped) token.className = 'target-token';
      else if (exercise.sentenceMode) token.className = 'target-sentence';
      for (const char of item) {
        const span = document.createElement('span');
        span.textContent = char;
        span.className = 'target-char';
        targetChars.push(span);
        token.append(span);
      }
      return token;
    }));
  }
  function renderText() {
    const typed = Array.from(previous);
    const caret = completed ? -1 : Array.from(input.value.slice(0, input.selectionStart)).length;
    targetChars.forEach((span, index) => {
      const matches = typed[index] === exercise.chars[index];
      span.classList.toggle('correct', matches);
      span.classList.toggle('wrong', index < typed.length && !matches);
      span.classList.toggle('current', index === caret);
    });
    const currentChar = targetChars[caret];
    if (currentChar) {
      const box = $('target').getBoundingClientRect();
      const cursor = currentChar.getBoundingClientRect();
      if (cursor.bottom > box.bottom - 12) $('target').scrollTop += cursor.bottom - box.bottom + 12;
      else if (cursor.top < box.top + 12) $('target').scrollTop -= box.top + 12 - cursor.top;
    }
    $('progress-fill').max = Math.max(1, exercise.chars.length);
    $('progress-fill').value = correctCount();
    $('locate-error').hidden = firstError() < 0;
    $('locate-error').disabled = paused;
    if (section === 'keyboard') {
      const key = exercise.chars[caret];
      keyboardKeys.forEach((node, letter) => node.classList.toggle('key-next', letter === key));
      $('key-finger').textContent = key ? `下一键 ${key.toUpperCase()} · ${fingers[key]}` : '食指回到 F 和 J 键。';
    }
    renderStats();
  }
  function startClock() {
    if (startedAt === null && !paused && !completed && !pauseRequested) startedAt = performance.now();
    $('pause').disabled = completed;
  }
  function stopClock() { elapsed = duration(); startedAt = null; }
  function pausePractice(message = '已暂停计时，点击“继续练习”恢复。') {
    if (completed || !active()) return;
    stopClock();
    if (composing) { pauseRequested = true; saveDraft(); return; }
    paused = true; pauseRequested = false; input.readOnly = true;
    $('pause').textContent = '继续练习'; $('pause').disabled = false;
    $('input-help').textContent = message;
    $('locate-error').disabled = true;
    saveDraft();
    renderStats();
  }
  function resetPractice() {
    attemptId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    previous = ''; composing = completed = paused = pauseRequested = false;
    startedAt = null; elapsed = attempts = hits = 0;
    missedItems = new Set();
    input.value = ''; input.readOnly = false;
    input.lang = section === 'keyboard' ? 'en' : 'zh-CN';
    $('target').scrollTop = 0;
    $('result').hidden = true;
    $('pause').textContent = '暂停练习'; $('pause').disabled = true;
    $('lesson-number').textContent = exercise.caption;
    $('lesson-title').textContent = exercise.title;
    $('total-count').textContent = `/ ${exercise.chars.length} 字符`;
    $('restart').textContent = section === 'intro' ? '重新练习' : '重练本组';
    $('target-instruction').textContent = section === 'keyboard' ? '切换到英文输入，按顺序打小写字母和半角分号，无需空格'
      : exercise.grouped ? '按顺序输入，字词之间直接接着打' : '照着下面的文字输入，遇到标点也一起输入';
    $('input-help').textContent = section === 'keyboard' ? '建议使用实体键盘，敲下第一键开始计时。' : '开始组字时计时，选字后核对。';
    renderNavigation(); renderExercise(); renderText();
  }
  function loadRandom(nextSettings = settings, restoredItems) {
    const previousItems = section === 'random' && exercise ? exercise.items : [];
    settings = { ...nextSettings };
    section = 'random';
    const generated = restoredItems ? { items: restoredItems, text: restoredItems.join('') } : generate(settings, previousItems);
    const mode = modes[settings.mode];
    exercise = {
      ...generated, chars: Array.from(generated.text), grouped: settings.mode === 'words', sentenceMode: settings.mode === 'sentences',
      title: settings.mode === 'words' ? levels.find(level => level.id === settings.level).title : mode.title,
      caption: `随机练习 / ${mode.title} / ${generated.items.length} ${mode.unit}`
    };
    writeStore(settingsKey, settings);
    resetPractice();
  }
  function loadIntro(index) {
    section = 'intro'; selected = index;
    const lesson = lessons[index];
    exercise = {
      ...lesson, chars: Array.from(lesson.text), grouped: Boolean(lesson.words), sentenceMode: lesson.items.length > 1,
      caption: `${units[lesson.unitIndex].title} / 第 ${index + 1} 节，共 ${lessons.length} 节`
    };
    resetPractice();
  }
  function loadTraining(mode, config = {}) {
    sessionData = readStore(sessionKey, sessionData);
    section = lastTraining = mode;
    keyStage = config.keyStage ?? keyStage;
    const day = mode === 'daily' ? config.day || dayKey() : undefined;
    let items = config.items;
    let title, caption;
    if (mode === 'keyboard') {
      const lesson = keyLessons[keyStage];
      items = lesson.items;
      title = lesson.title;
      caption = '键位盲打';
    } else if (mode === 'review') {
      items ??= rankedReview(sessionData.review).slice(0, 8).map(([item]) => item);
      title = '易错字词';
      caption = `错字复练 / ${items.length} 项`;
    } else {
      items ??= dailyItems(day, sentences);
      title = '每日挑战';
      caption = `${day} / ${items.length} 句`;
    }
    const text = items.join('');
    exercise = { items, text, chars: Array.from(text), grouped: mode !== 'daily', sentenceMode: mode === 'daily', title, caption, day };
    resetPractice();
  }
  function restoreDraft(draft) {
    if (!draft || typeof draft.id !== 'string' || typeof draft.text !== 'string' || !Array.isArray(draft.items)) return false;
    if (!Number.isFinite(draft.elapsed) || draft.elapsed < 0 || !Number.isSafeInteger(draft.attempts) || !Number.isSafeInteger(draft.hits) || draft.hits < 0 || draft.attempts < draft.hits) return false;
    if (draft.section === 'intro' && Number.isInteger(draft.selected) && lessons[draft.selected]) {
      const items = lessons[draft.selected].items;
      if (draft.items.length !== items.length || !draft.items.every((item, i) => item === items[i])) return false;
      loadIntro(draft.selected);
    } else if (draft.section === 'random') {
      const config = readSettings(draft.settings);
      const level = levels.find(item => item.id === config.level);
      const pool = { words: level.items, characters, sentences }[config.mode];
      if (draft.items.length !== modes[config.mode].counts[config.size] || !draft.items.every(item => pool.includes(item))) return false;
      loadRandom(config, draft.items);
    } else if (draft.section === 'keyboard') {
      const lesson = keyLessons[draft.keyStage];
      if (!lesson || JSON.stringify(draft.items) !== JSON.stringify(lesson.items)) return false;
      loadTraining('keyboard', { keyStage: draft.keyStage });
    } else if (draft.section === 'review') {
      if (!draft.items.length || draft.items.length > 8 || !draft.items.every(isReviewItem)) return false;
      loadTraining('review', { items: draft.items });
    } else if (draft.section === 'daily') {
      if (!validDay(draft.day) || draft.items.length !== 3 || new Set(draft.items).size !== 3 || !draft.items.every(item => sentences.includes(item))) return false;
      loadTraining('daily', { day: draft.day, items: draft.items });
    } else return false;
    attemptId = draft.id;
    input.value = previous = draft.text;
    elapsed = draft.elapsed;
    attempts = draft.attempts;
    hits = draft.hits;
    missedItems = new Set(Array.isArray(draft.misses) ? draft.misses.filter(isReviewItem).slice(0, 80) : []);
    pausePractice('已恢复上次练习，点击“继续练习”开始计时。');
    renderText();
    return true;
  }
  function requestChange(action, restarting = false) {
    $('key-stage').value = keyStage;
    if (composing) { syncSettings(); $('input-help').textContent = '请先完成或取消输入法选字，再切换练习。'; return; }
    if (!active()) { action(); return; }
    pausePractice();
    pendingAction = action;
    $('replace-title').textContent = restarting ? '重新练习当前内容？' : '开始新的练习？';
    $('confirm-replace').textContent = restarting ? '重新练习' : '开始新练习';
    syncSettings();
    $('replace-dialog').showModal();
  }
  function collectMiss(next, wrong, editStart, editEnd) {
    // Only the first mismatch in newly committed input can enter the review queue.
    // This avoids recording every later character when one missing character shifts a line.
    if (section === 'keyboard' || wrong < editStart || wrong >= editEnd) return;
    const expected = exercise.chars[wrong];
    if (!isReviewItem(expected) || (section !== 'review' && !isReviewItem(next[wrong]))) return;
    if (!exercise.grouped) { missedItems.add(expected); return; }
    let end = 0;
    for (const word of exercise.items) {
      end += Array.from(word).length;
      if (wrong < end) {
        if (isReviewItem(word)) missedItems.add(word);
        return;
      }
    }
  }
  function commitInput() {
    if (composing || completed || paused) return;
    const next = Array.from(input.value);
    if (next.join('') === previous) return;
    startClock();
    const old = Array.from(previous);
    let prefix = 0;
    while (prefix < old.length && prefix < next.length && old[prefix] === next[prefix]) prefix++;
    let suffix = 0;
    while (suffix < old.length - prefix && suffix < next.length - prefix && old[old.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
    const editEnd = next.length - suffix;
    for (let i = prefix; i < editEnd; i++) { attempts++; if (next[i] === exercise.chars[i]) hits++; }
    previous = next.join('');
    const wrong = firstError();
    collectMiss(next, wrong, prefix, editEnd);
    renderText();
    $('input-help').textContent = next.length > exercise.chars.length ? `多输入了 ${next.length - exercise.chars.length} 个字符，请删除多余内容。`
      : section === 'keyboard' && /[^a-z;]/u.test(previous) ? '请切到英文小写，使用半角分号。'
      : /\s/u.test(previous) ? '这里不用输入空格或换行，请删除后继续。'
      : wrong >= 0 ? `第 ${wrong + 1} 个字符不一致，请检查错字或漏字。` : '目前输入正确。';
    if (previous === exercise.text) finish(); else saveDraft();
  }
  function finish() {
    stopClock(); completed = true; pauseRequested = false; input.readOnly = true;
    $('pause').disabled = true;
    const score = { accuracy: accuracy(), speed: speed() };
    const lesson = section === 'intro' ? lessons[selected] : null;
    const stars = lesson ? rating(score, lesson) : 0;
    const entry = {
      id: attemptId, mode: section === 'random' ? settings.mode : section,
      title: exercise.title, at: Date.now(), elapsed, ...score, stars
    };
    let isNew = false, newDailyBest = false;
    updateSession(data => {
      const history = Array.isArray(data.history) ? data.history : [];
      isNew = !history.some(item => item?.id === attemptId);
      const updated = { ...data, draft: data.draft?.id === attemptId ? null : data.draft };
      if (!isNew) return updated;
      updated.history = [entry, ...history].slice(0, 100);
      if (missedItems.size || section === 'review') {
        updated.review = updateReview(data.review, missedItems, section === 'review' ? exercise.items : [], entry.at);
      }
      if (section === 'daily') {
        const best = data.dailyScores?.[exercise.day];
        newDailyBest = !best || score.accuracy > best.accuracy || (score.accuracy === best.accuracy && score.speed > best.speed);
        if (newDailyBest) updated.dailyScores = { ...data.dailyScores, [exercise.day]: score };
      }
      return updated;
    });
    if (section === 'random' && isNew) {
      const latest = readStore(randomKey, randomRecord);
      if (Number.isSafeInteger(latest?.count) && latest.count > randomRecord.count) randomRecord = latest;
      randomRecord = { count: randomRecord.count + 1, last: { ...score, mode: settings.mode, level: settings.level, characters: exercise.chars.length } };
      writeStore(randomKey, randomRecord);
    } else if (section === 'intro' && isNew) {
      records = { ...readStore(introKey, records) };
      if (betterScore(score, records[selected], lesson)) records[selected] = score;
      writeStore(introKey, records);
    }
    $('result').hidden = false;
    $('result-title').textContent = lesson ? `本课完成 · ${stars} / 5 星` : '练习完成';
    $('result-detail').textContent = `${score.speed} ${speedUnit()} · 准确率 ${score.accuracy}% · 用时 ${durationLabel(elapsed)}`;
    $('result-advice').hidden = !lesson && section !== 'daily' && section !== 'keyboard' && section !== 'review';
    $('review-misses').hidden = !missedItems.size;
    if (lesson) {
      $('result-advice').textContent = stars === 5 ? '已达五星目标。'
        : score.accuracy < 98 ? '重练时先留意容易输错的字词，向 98% 准确率靠近。'
        : `准确率已达标。重练时保持准确，试着达到 ${lesson.speed} 字/分钟。`;
    } else if (section === 'daily') {
      $('result-title').textContent = '挑战完成';
      $('result-advice').textContent = newDailyBest ? '刷新了当天个人最佳。' : '已记入打字记录，仍保留当天的最佳成绩。';
    } else if (section === 'keyboard') {
      $('result-advice').textContent = score.accuracy >= 95 ? '准确率已达 95%。可以继续，或关闭键位提示重练。' : '试着慢一点，先把本阶段练到 95% 准确率。';
    } else if (section === 'review') {
      const corrected = exercise.items.length - missedItems.size;
      $('result-advice').textContent = `本组一次打对 ${corrected} 项。再次打错的字词会留在错字本。`;
    }
    $('input-help').textContent = '速度按正确字符计算，含标点。准确率计入改正前的错误。';
    const nextLabels = {
      random: '练习下一组', intro: selected < lessons.length - 1 ? '下一节' : '再练一次',
      keyboard: keyStage < keyLessons.length - 1 ? '下一阶段' : '再练一次', review: '查看待复练',
      daily: exercise.day === dayKey() ? '再挑战一次' : '练今天的挑战'
    };
    $('next').textContent = nextLabels[section];
    renderNavigation(); renderText();
  }
  const historyDate = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  function renderHistory() {
    const entries = readStore(sessionKey, sessionData)?.history;
    const history = Array.isArray(entries) ? entries.filter(item => item && Number.isFinite(item.at) && item.at > 0 && item.at <= 8.64e15) : [];
    const today = new Date().toDateString();
    const todayEntries = history.filter(item => new Date(item.at).toDateString() === today);
    const todayTime = todayEntries.reduce((sum, item) => sum + item.elapsed, 0);
    $('history-today').textContent = `今日记录 ${todayEntries.length} 次 · 累计练习 ${durationLabel(todayTime)}`;
    const filter = $('history-filter').value;
    const shown = filter === 'all' ? history : history.filter(item => item.mode === filter);
    $('history-empty').hidden = shown.length > 0;
    $('history-empty').textContent = filter === 'all' ? '完成一次练习后，成绩会出现在这里。' : '这个类型还没有成绩。';
    $('history-table-wrap').hidden = !shown.length;
    $('history-rows').replaceChildren(...shown.map(item => {
      const row = document.createElement('tr');
      const title = item.stars ? `${item.title} · ${item.stars} 星` : item.title;
      const pace = `${item.speed} ${item.mode === 'keyboard' ? '字符/分钟' : '字/分钟'}`;
      for (const value of [historyDate.format(item.at), title, durationLabel(item.elapsed), pace, `${item.accuracy}%`]) {
        row.insertCell().textContent = value;
      }
      return row;
    }));
  }
  input.addEventListener('compositionstart', () => {
    if (!paused && !completed) { composing = true; startClock(); }
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    commitInput();
    if (pauseRequested) pausePractice('已自动暂停，点击“继续练习”恢复。');
  });
  input.addEventListener('input', event => { if (!event.isComposing) commitInput(); });
  for (const event of ['click', 'keyup', 'select']) input.addEventListener(event, () => { if (!composing) renderText(); });
  for (const event of ['paste', 'drop']) input.addEventListener(event, e => {
    e.preventDefault(); $('input-help').textContent = '请亲手输入练习文字，暂不支持粘贴。';
  });
  $('random-tab').addEventListener('click', () => { if (section !== 'random') requestChange(() => loadRandom()); });
  $('intro-tab').addEventListener('click', () => {
    if (section !== 'intro') requestChange(() => loadIntro(recommendedLesson()?.index ?? 0));
  });
  $('training-tab').addEventListener('click', () => {
    if (!Object.hasOwn(trainingModes, section)) requestChange(() => loadTraining(lastTraining));
  });
  $('key-stage').addEventListener('change', () => {
    const stage = Number($('key-stage').value);
    if (keyLessons[stage]) requestChange(() => loadTraining('keyboard', { keyStage: stage }));
  });
  $('key-hints-toggle').addEventListener('click', () => {
    keyHints = !keyHints;
    writeStore('zixi-key-hints-v1', keyHints);
    $('key-hints-toggle').setAttribute('aria-pressed', String(keyHints));
    $('key-guide').hidden = !keyHints;
  });
  $('review-seed').addEventListener('click', () => {
    loadRandom({ ...settings, mode: 'words' });
    input.focus();
  });
  $('review-misses').addEventListener('click', () => {
    loadTraining('review', { items: [...missedItems].slice(0, 8) });
    input.focus();
  });
  $('continue-course').addEventListener('click', () => {
    const next = recommendedLesson()?.index ?? 0;
    if (next !== selected) requestChange(() => { loadIntro(next); input.focus(); });
    else if (paused) $('pause').click();
    else input.focus();
  });
  $('shuffle').addEventListener('click', () => requestChange(() => loadRandom()));
  $('level').addEventListener('change', () => {
    const nextSettings = { ...settings, level: $('level').value };
    requestChange(() => loadRandom(nextSettings));
  });
  $('length').addEventListener('change', () => {
    const nextSettings = { ...settings, size: Number($('length').value) };
    requestChange(() => loadRandom(nextSettings));
  });
  $('restart').addEventListener('click', () => requestChange(() => { resetPractice(); input.focus(); }, true));
  $('next').addEventListener('click', () => {
    if (section === 'random') loadRandom();
    else if (section === 'intro') loadIntro(Math.min(selected + 1, lessons.length - 1));
    else if (section === 'keyboard') loadTraining('keyboard', { keyStage: Math.min(keyStage + 1, keyLessons.length - 1) });
    else loadTraining(section);
    if (exercise.items.length) input.focus(); else $('review-seed').focus();
  });
  $('keep-practice').addEventListener('click', () => { pendingAction = null; $('replace-dialog').close(); });
  $('replace-dialog').addEventListener('cancel', () => { pendingAction = null; });
  $('confirm-replace').addEventListener('click', () => {
    const action = pendingAction;
    pendingAction = null; $('replace-dialog').close();
    if (action) { discardDraft(); action(); }
  });
  $('pause').addEventListener('click', () => {
    if (completed || composing) return;
    if (paused) {
      paused = false; input.readOnly = false; startClock(); input.focus();
      $('pause').textContent = '暂停练习'; $('input-help').textContent = '已继续练习。';
      $('locate-error').disabled = false;
    } else pausePractice();
    renderStats();
  });
  $('locate-error').addEventListener('click', () => {
    if (composing || paused) return;
    const index = firstError();
    if (index < 0) return;
    const chars = Array.from(previous);
    const offset = chars.slice(0, index).join('').length;
    input.focus();
    input.setSelectionRange(offset, offset + chars[index].length);
    renderText();
  });
  function setTextSize(large) {
    $('text-size').setAttribute('aria-pressed', String(large));
    $('typing').closest('.practice').classList.toggle('large-text', large);
  }
  $('text-size').addEventListener('click', () => {
    const large = $('text-size').getAttribute('aria-pressed') !== 'true';
    setTextSize(large);
    writeStore('zixi-large-text-v1', large);
    if (!composing) renderText();
  });
  $('history-open').addEventListener('click', () => {
    if (composing) { $('input-help').textContent = '请先完成选字，再打开练习记录。'; return; }
    pausePractice();
    renderHistory();
    $('history-dialog').showModal();
  });
  $('history-filter').addEventListener('change', renderHistory);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pausePractice('已自动暂停，回来后点击“继续练习”。'); });
  window.addEventListener('blur', () => pausePractice('已自动暂停，回来后点击“继续练习”。'));
  window.addEventListener('pagehide', saveDraft);
  setInterval(() => { if (startedAt !== null) renderStats(); }, 500);
  setTextSize(readStore('zixi-large-text-v1', false) === true);
  if (!restoreDraft(sessionData.draft)) loadRandom();
})();

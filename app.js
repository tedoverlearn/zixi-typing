(() => {
  'use strict';
  const { levels, modes, characters, sentences, generate } = window.PracticeData;
  const { units, lessons, rating, betterScore } = window.CourseData;
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
      text: previous, elapsed: duration(), attempts, hits
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
    $('random-tab').classList.toggle('nav-current', random);
    $('intro-tab').classList.toggle('nav-current', !random);
    $('random-tab').setAttribute('aria-pressed', String(random));
    $('intro-tab').setAttribute('aria-pressed', String(!random));
    $('section-name').textContent = random ? '随机练习' : '系统课程';
    $('section-description').textContent = random ? '选一种练习，用自己的中文输入法跟打。' : '从字词到篇章，按顺序练习，也可以直接选你想练的课。';
    $('random-settings').hidden = !random;
    $('course-path').hidden = random;
    $('course-guidance').hidden = random;
    $('lessons').classList.toggle('course-lessons', !random);
    if (!random) renderCoursePath();
    const options = random ? Object.entries(modes).map(([id, mode]) => ({ ...mode, id }))
      : lessons.filter(lesson => lesson.unitIndex === lessons[selected].unitIndex);
    $('lessons').replaceChildren(...options.map((option, i) => {
      const button = document.createElement('button');
      const current = random ? option.id === settings.mode : option.index === selected;
      button.className = 'lesson' + (current ? ' active' : '');
      button.setAttribute('aria-pressed', String(current));
      const stars = random ? 0 : courseStars(option);
      const detail = random ? option.subtitle : stars ? `最佳 ${stars} / 5 星` : '待练习';
      button.innerHTML = `<span class="lesson-index">${random ? ['词', '字', '句'][i] : option.index + 1}</span><span><strong>${option.title}</strong><small>${detail}</small></span>`;
      button.addEventListener('click', () => {
        if (current) return;
        requestChange(() => random ? loadRandom({ ...settings, mode: option.id }) : loadIntro(option.index));
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
    syncSettings();
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
    $('progress-fill').max = exercise.chars.length;
    $('progress-fill').value = correctCount();
    $('locate-error').hidden = firstError() < 0;
    $('locate-error').disabled = paused;
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
    input.value = ''; input.readOnly = false;
    $('target').scrollTop = 0;
    $('result').hidden = true;
    $('pause').textContent = '暂停练习'; $('pause').disabled = true;
    $('lesson-number').textContent = exercise.caption;
    $('lesson-title').textContent = exercise.title;
    $('total-count').textContent = `/ ${exercise.chars.length} 字符`;
    $('restart').textContent = section === 'random' ? '重练本组' : '重新练习';
    $('target-instruction').textContent = exercise.grouped ? '按顺序输入，词语之间直接接着打' : '照着下面的文字输入，遇到标点也一起输入';
    $('input-help').textContent = '开始组字时计时，选字后核对。';
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
    } else return false;
    attemptId = draft.id;
    input.value = previous = draft.text;
    elapsed = draft.elapsed;
    attempts = draft.attempts;
    hits = draft.hits;
    pausePractice('已恢复上次练习，点击“继续练习”开始计时。');
    renderText();
    return true;
  }
  function requestChange(action, restarting = false) {
    if (composing) { syncSettings(); $('input-help').textContent = '请先完成或取消输入法选字，再切换练习。'; return; }
    if (!active()) { action(); return; }
    pausePractice();
    pendingAction = action;
    $('replace-title').textContent = restarting ? '重新练习当前内容？' : '开始新的练习？';
    $('confirm-replace').textContent = restarting ? '重新练习' : '开始新练习';
    syncSettings();
    $('replace-dialog').showModal();
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
    for (let i = prefix; i < next.length - suffix; i++) { attempts++; if (next[i] === exercise.chars[i]) hits++; }
    previous = next.join('');
    renderText();
    const wrong = firstError();
    $('input-help').textContent = next.length > exercise.chars.length ? `多输入了 ${next.length - exercise.chars.length} 个字符，请删除多余内容。`
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
      id: attemptId, mode: section === 'random' ? settings.mode : 'intro',
      title: exercise.title, at: Date.now(), elapsed, ...score, stars
    };
    let isNew = false;
    updateSession(data => {
      const history = Array.isArray(data.history) ? data.history : [];
      isNew = !history.some(item => item?.id === attemptId);
      return { ...data, draft: data.draft?.id === attemptId ? null : data.draft,
        history: isNew ? [entry, ...history].slice(0, 100) : history };
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
    $('result-detail').textContent = `${score.speed} 字/分钟 · 准确率 ${score.accuracy}% · 用时 ${durationLabel(elapsed)}`;
    $('result-advice').hidden = !lesson;
    if (lesson) {
      $('result-advice').textContent = stars === 5 ? '已达五星目标。'
        : score.accuracy < 98 ? '重练时先留意容易输错的字词，向 98% 准确率靠近。'
        : `准确率已达标。重练时保持准确，试着达到 ${lesson.speed} 字/分钟。`;
    }
    $('input-help').textContent = '速度按正确字符计算，含标点。准确率计入改正前的错误。';
    $('next').textContent = section === 'random' ? '练习下一组' : selected < lessons.length - 1 ? '下一节' : '再练一次';
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
      for (const value of [historyDate.format(item.at), title, durationLabel(item.elapsed), item.speed, `${item.accuracy}%`]) {
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
    if (section === 'random') loadRandom(); else loadIntro(Math.min(selected + 1, lessons.length - 1));
    input.focus();
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

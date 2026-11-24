(function (root) {
  'use strict';

  const minLength = 10;
  const maxLength = 600;

  function splitSegments(text) {
    const chars = Array.from(text);
    const segments = [];
    let start = 0;
    for (let i = 0; i < chars.length; i++) {
      const endOfSentence = /[。！？；!?]/u.test(chars[i]);
      const endOfChunk = i - start >= 59;
      if (!endOfSentence && !endOfChunk) continue;
      while (i + 1 < chars.length && /[。！？；!?」』”’）》】\s]/u.test(chars[i + 1])) i++;
      segments.push(chars.slice(start, i + 1).join(''));
      start = i + 1;
    }
    if (start < chars.length) segments.push(chars.slice(start).join(''));
    return segments;
  }

  function parsePassage(source) {
    const lines = source.split(/\r\n|[\n\r\u2028\u2029]/u).map(line => line
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\ufeff]/gu, '')
      .replace(/[\t\u00a0\u3000]+/gu, ' ').trim()).filter(Boolean);
    const length = Array.from(lines.join('')).length;
    if (length < minLength || length > maxLength) return { length, items: null };
    return { length, items: lines.flatMap(splitSegments) };
  }

  function makeTrace(items, saved) {
    let end = 0;
    return items.flatMap(splitSegments).map((text, index) => {
      const start = end;
      end += Array.from(text).length;
      const prior = saved?.[index];
      return {
        text, start, end,
        at: Number.isFinite(prior?.at) && prior.at >= 0 ? prior.at : null,
        uncertain: prior?.uncertain === true,
        errors: Number.isSafeInteger(prior?.errors) && prior.errors >= 0 ? prior.errors : 0
      };
    });
  }

  function updateTrace(trace, { prefix, wrong, editStart, editEnd, time }) {
    const incorrect = trace.find(row => row.start <= wrong && wrong < row.end);
    if (incorrect && wrong >= editStart && wrong < editEnd) {
      incorrect.errors++;
      if (incorrect.at !== null) incorrect.uncertain = true;
    }
    let sharedBoundary = false;
    for (const row of trace) {
      if (row.at !== null) continue;
      if (sharedBoundary) row.uncertain = true;
      if (prefix < row.end) break;
      if (prefix > row.end || editEnd < row.end) {
        row.uncertain = true;
        sharedBoundary = true;
      }
      row.at = time;
    }
  }

  function reportRows(trace) {
    return trace.map((row, index) => {
      const previous = trace[index - 1];
      const ms = row.at - (previous?.at ?? 0);
      const reliable = !row.uncertain && row.at !== null && ms > 0;
      return { ...row, index, ms: reliable ? ms : null, msPerChar: reliable ? ms / (row.end - row.start) : null };
    });
  }

  function recommendedSegment(rows) {
    const missed = rows.filter(row => row.errors).sort((a, b) => b.errors - a.errors)[0];
    if (missed) return { index: missed.index, reason: '出错最多' };
    const timed = rows.filter(row => row.msPerChar !== null);
    if (timed.length < 2) return null;
    const slowest = timed.sort((a, b) => b.msPerChar - a.msPerChar)[0];
    const fastest = Math.min(...timed.map(row => row.msPerChar));
    return slowest.msPerChar > fastest * 1.15 ? { index: slowest.index, reason: '每字用时较长' } : null;
  }

  // The history keeps a material fingerprint rather than a copy of the text.
  function materialId(text) {
    let hash = 2166136261;
    for (const char of text) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
    return `${text.length}-${hash.toString(16)}`;
  }

  const api = { minLength, maxLength, parsePassage, makeTrace, updateTrace, reportRows, recommendedSegment, materialId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PassageData = api;
})(globalThis);

'use strict';
// index.html이 외부 자원을 부르지 않고, 데이터를 내보내거나 저장하는 API를 쓰지 않는지 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readHtml } = require('./load-core');

const html = readHtml();

test('외부 주소를 가리키는 src·href·url()이 없다', () => {
  const refs = [...html.matchAll(/\b(?:src|href|action)\s*=\s*["']?([^"'\s>]+)/gi)].map(m => m[1]);
  for (const ref of refs) {
    assert.ok(!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref), '외부 참조: ' + ref);
  }
  assert.ok(!/url\(/i.test(html), 'CSS url()을 쓰지 않는다');
  assert.ok(!/@import/i.test(html), 'CSS @import를 쓰지 않는다');
  assert.ok(!/https?:\/\//i.test(html), 'http(s) 주소가 없다');
});

test('<script src>·<link>로 외부 파일을 불러오지 않는다', () => {
  assert.ok(!/<script[^>]*\bsrc\s*=/i.test(html));
  assert.ok(!/<link\b/i.test(html));
  assert.ok(!/<(?:iframe|img|object|embed|form)\b/i.test(html));
});

test('네트워크·저장 API를 쓰지 않는다', () => {
  const banned = [
    'fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
    'caches', 'serviceWorker', 'postMessage', 'window.open', 'importScripts', 'eval',
  ];
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
  for (const word of banned) {
    const re = new RegExp('\\b' + word.replace('.', '\\.') + '\\b');
    assert.ok(!re.test(scripts), '쓰면 안 되는 API: ' + word);
  }
});

test('콘텐츠 보안 정책이 외부 연결을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP meta가 있다');
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /base-uri 'none'/);
  // script·style은 인라인만 허용하고 출처를 열지 않는다.
  for (const part of csp.split(';')) {
    assert.ok(!/https?:|\*|'self'/.test(part), 'CSP가 출처를 열지 않는다: ' + part.trim());
  }
});

test('입력 칸은 맞춤법 검사·자동완성을 끈다', () => {
  const m = html.match(/<textarea[^>]*>/);
  assert.ok(m);
  assert.match(m[0], /spellcheck="false"/);
  assert.match(m[0], /autocomplete="off"/);
});

test('화면 코드는 붙여넣은 값을 innerHTML로 넣지 않는다', () => {
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(html));
});

test('결과 표 머리글 순서: 문항 / 유효 응답 / 평균 / 빈 응답 / 제외', () => {
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  const cols = [...thead.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1]);
  assert.deepEqual(cols, ['문항', '유효 응답', '평균', '빈 응답', '제외']);
});

test('저장소 맨 위에 빈 .nojekyll 파일이 있다', () => {
  const p = path.join(__dirname, '..', '.nojekyll');
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});

'use strict';
// index.html이 외부 자원을 부르지 않고 네트워크·저장 API를 쓰지 않는지 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readHtml } = require('./load-core');

const html = readHtml();
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');

test('외부 주소를 가리키는 src·href·url()이 없다', () => {
  const refs = [...html.matchAll(/\b(?:src|href|action)\s*=\s*["']?([^"'\s>]+)/gi)].map(m => m[1]);
  for (const ref of refs) {
    assert.ok(!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref), '외부 참조: ' + ref);
  }
  assert.ok(!/url\(/i.test(html), 'CSS url()을 쓰지 않는다');
  assert.ok(!/@import/i.test(html), 'CSS @import를 쓰지 않는다');
  assert.ok(!/https?:\/\//i.test(html), 'http(s) 주소가 없다');
});

test('<script src>·<link>·외부 내장 요소가 없다', () => {
  assert.ok(!/<script[^>]*\bsrc\s*=/i.test(html));
  assert.ok(!/<link\b/i.test(html));
  assert.ok(!/<(?:iframe|img|object|embed|form|audio|video)\b/i.test(html));
});

test('네트워크·저장 API를 쓰지 않는다', () => {
  const banned = [
    'fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
    'serviceWorker', 'postMessage', 'window.open', 'importScripts', 'eval',
  ];
  for (const word of banned) {
    const re = new RegExp('\\b' + word.replace('.', '\\.') + '\\b');
    assert.ok(!re.test(scripts), '쓰면 안 되는 API: ' + word);
  }
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(scripts));
});

test('콘텐츠 보안 정책이 외부 연결을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP meta가 있다');
  assert.match(m[1], /default-src 'none'/);
  assert.match(m[1], /form-action 'none'/);
  assert.match(m[1], /base-uri 'none'/);
  for (const part of m[1].split(';')) {
    assert.ok(!/https?:|\*|'self'/.test(part), 'CSP가 출처를 열지 않는다: ' + part.trim());
  }
});

test('게임 로직 블록은 화면 객체를 쓰지 않는다', () => {
  const core = html.match(/<script id="game-core">([\s\S]*?)<\/script>/)[1];
  assert.ok(!/\b(?:document|window|setTimeout|addEventListener)\b/.test(core));
});

test('저장소 맨 위에 빈 .nojekyll 파일이 있다', () => {
  const p = path.join(__dirname, '..', '.nojekyll');
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});

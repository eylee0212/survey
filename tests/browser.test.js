'use strict';
// 실제 브라우저에서 붙여넣기 → 결과 표를 확인한다.
// Playwright가 없는 환경에서는 건너뛴다(계산 자체는 core.test.js가 확인한다).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* 없으면 건너뜀 */ }

const pageUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

test('브라우저에서 붙여넣으면 표가 나오고, 외부 요청이 없다', { skip: !playwright && 'playwright 없음' }, async () => {
  const browser = await playwright.chromium.launch();
  try {
    const context = await browser.newContext();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();

    const requests = [];
    const errors = [];
    page.on('request', req => { if (req.url() !== pageUrl) requests.push(req.url()); });
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(String(err)));

    await page.goto(pageUrl);
    assert.equal(await page.isHidden('#result'), true);

    // 엑셀이 클립보드에 넣는 모양: 탭 구분, \r\n 줄바꿈, 끝에 줄바꿈
    const pasted = [
      '응답번호\t만족도\t추천\t<b>자유</b>',
      '1\t5\t4\t좋음',
      '2\t 3 \t\t',
      '3\t6',
    ].join('\r\n') + '\r\n';
    await page.evaluate(t => navigator.clipboard.writeText(t), pasted);
    await page.focus('#input');
    await page.keyboard.press('ControlOrMeta+V');

    await page.waitForSelector('#result:not([hidden])');
    const rows = await page.$$eval('#result tbody tr', trs =>
      trs.map(tr => [...tr.children].map(c => c.textContent)));
    assert.deepEqual(rows, [
      ['만족도', '2', '4.00', '0', '1'],
      ['추천', '1', '4.00', '2', '0'],
      ['<b>자유</b>', '0', '-', '2', '1'],
    ]);
    // 머리글의 HTML은 글자 그대로 보이고 요소로 바뀌지 않는다.
    assert.equal(await page.$$eval('#result b', els => els.length), 0);
    assert.match(await page.textContent('#status'), /문항 3개, 응답 3줄/);
    assert.match(await page.textContent('#notes'), /모자란 줄 1개/);

    await page.click('#clear');
    assert.equal(await page.inputValue('#input'), '');
    assert.equal(await page.isHidden('#result'), true);

    // 저장소에 아무것도 남기지 않는다.
    const stored = await page.evaluate(() => {
      try { return localStorage.length + sessionStorage.length; } catch (e) { return 0; }
    });
    assert.equal(stored, 0);

    assert.deepEqual(requests, [], '외부 요청: ' + requests.join(', '));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

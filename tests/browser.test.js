'use strict';
// 실제 브라우저에서 클릭해 두고 결과를 확인한다.
// Playwright가 없는 환경에서는 건너뛴다(규칙 자체는 core.test.js가 확인한다).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* 없으면 건너뜀 */ }

const pageUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const skip = !playwright && 'playwright 없음';

async function withPage(fn) {
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = [];
    const errors = [];
    page.on('request', req => { if (req.url() !== pageUrl) requests.push(req.url()); });
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(String(err)));
    await page.goto(pageUrl);
    await fn(page);
    assert.deepEqual(requests, [], '외부 요청: ' + requests.join(', '));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

const cell = (r, c) => `.cell[data-idx="${r * 10 + c}"]`;
const stones = page => page.$$eval('.cell', els => els.map(e => (e.classList.contains('B') ? 'B' : e.classList.contains('W') ? 'W' : '')).join(''));

test('두 사람: 번갈아 두고 3개를 이으면 승리, 무르기·새 게임', { skip }, async () => {
  await withPage(async page => {
    assert.equal(await page.$$eval('.cell', els => els.length), 100);
    assert.equal(await page.textContent('#status'), '흑 차례');
    assert.equal(await page.isDisabled('#undo'), true);

    await page.click(cell(4, 3));
    assert.equal(await page.textContent('#status'), '백 차례');
    await page.click(cell(4, 3)); // 이미 돌이 있는 칸: 무시
    assert.equal(await page.textContent('#status'), '백 차례');
    await page.click(cell(0, 0));
    await page.click(cell(4, 4));
    await page.click(cell(0, 9));
    await page.click(cell(4, 5));

    assert.equal(await page.textContent('#status'), '흑 승리!');
    assert.equal(await page.$$eval('.cell.win', els => els.length), 3);
    assert.match(await page.getAttribute(cell(4, 4), 'aria-label'), /5행 5열, 흑, 승리 줄/);

    await page.click(cell(9, 9)); // 끝난 판: 무시
    assert.equal((await stones(page)).length, 5);
    assert.equal(await page.$eval(cell(9, 9), e => e.className), 'cell');

    await page.click('#undo');
    assert.equal(await page.textContent('#status'), '흑 차례');
    assert.equal(await page.$$eval('.cell.win', els => els.length), 0);
    assert.equal(await page.$eval(cell(4, 5), e => e.className), 'cell');

    await page.click('#restart');
    assert.equal(await stones(page), '');
    assert.equal(await page.textContent('#status'), '흑 차례');
  });
});

test('키보드: 방향키로 옮기고 Enter로 둔다', { skip }, async () => {
  await withPage(async page => {
    await page.focus(cell(4, 4));
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.idx), '55');
    await page.keyboard.press('Enter');
    assert.match(await page.$eval(cell(5, 5), e => e.className), /\bB\b/);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press(' ');
    assert.match(await page.$eval(cell(4, 5), e => e.className), /\bW\b/);
  });
});

test('컴퓨터 상대: 컴퓨터가 응수하고, 무르기는 내 수까지 되돌린다', { skip }, async () => {
  await withPage(async page => {
    await page.selectOption('#mode', 'cpu-white');
    assert.equal(await page.textContent('#status'), '내 차례(흑)');
    await page.click(cell(0, 0));
    await page.waitForFunction(() => document.querySelectorAll('.cell.W').length === 1);
    assert.equal(await page.textContent('#status'), '내 차례(흑)');

    await page.click('#undo');
    assert.equal(await stones(page), '');
    assert.equal(await page.isDisabled('#undo'), true);

    // 컴퓨터가 흑(먼저)
    await page.selectOption('#mode', 'cpu-black');
    await page.waitForFunction(() => document.querySelectorAll('.cell.B').length === 1);
    assert.equal(await page.textContent('#status'), '내 차례(백)');
    assert.equal(await page.isDisabled('#undo'), true);

    // 컴퓨터가 이길 때까지 내가 아무 빈 칸에나 둔다
    for (let i = 0; i < 50; i++) {
      const status = await page.textContent('#status');
      if (/승리|무승부/.test(status)) break;
      const free = await page.$$eval('.cell', els => els.findIndex(e => !e.classList.contains('B') && !e.classList.contains('W')));
      await page.click(`.cell[data-idx="${free}"]`);
      await page.waitForFunction(() => !/두는 중/.test(document.getElementById('status').textContent));
    }
    assert.equal(await page.textContent('#status'), '컴퓨터(흑) 승리!');
  });
});

test('휴대폰 폭에서 가로 스크롤이 없다', { skip }, async () => {
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await page.goto(pageUrl);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
    const box = await page.$eval('.cell', e => e.getBoundingClientRect().width);
    assert.ok(box >= 30, `칸 너비 ${box}px`);
  } finally {
    await browser.close();
  }
});

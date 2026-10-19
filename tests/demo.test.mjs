import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'demo', 'index.html'), 'utf8');

test('Demo 是中文、自包含的单页，离线可用', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="zh-CN">/);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('Demo 具备顶栏、曲库、播放条与队列四块结构', () => {
  assert.match(html, /class="topbar"/);
  assert.match(html, /id="search"/);
  assert.match(html, /id="list"/);
  assert.match(html, /class="player"/);
  assert.match(html, /id="seek"/);
  assert.match(html, /id="playBtn"/);
  assert.match(html, /id="queue"/);
  assert.match(html, /id="queueList"/);
});

test('所有按钮都有可访问名称', () => {
  const buttons = html.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttons.length >= 7, '按钮数量不足：' + buttons.length);
  for (const tag of buttons) {
    assert.match(tag, /aria-label="[^"]+"/);
  }
});

test('内置示例曲目，且播放条与列表使用同一份数据', () => {
  assert.match(html, /夜航西飞/);
  assert.match(html, /Midnight Drive/);
  assert.match(html, /const TRACKS = \[/);
  assert.match(html, /renderQueue/);
});

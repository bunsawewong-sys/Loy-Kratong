import { execFileSync } from 'node:child_process';
import { devices, expect, test, type Browser, type Page } from '@playwright/test';

const DB = 'http://127.0.0.1:9000';
const NS = 'demo-loy-kratong-default-rtdb';

async function dbPatch(path: string, body: unknown) {
  await fetch(`${DB}/${path}.json?ns=${NS}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner' },
    body: JSON.stringify(body),
  });
}

async function phone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'th-TH' });
  return ctx.newPage();
}

async function launch(p: Page, name: string, wish: string) {
  await p.goto('/');
  await p.fill('#name', name);
  await p.click('#to-decorate');
  await p.click('#to-wish');
  await p.fill('#wish', wish);
  await expect(p.locator('#launch')).toBeEnabled();
  await p.click('#launch');
}

test.beforeAll(async () => {
  execFileSync('node', ['scripts/seed.mjs']);
  await dbPatch('config', { open: true, cooldownSec: 180 });
});

test('player floats a krathong and it shows up for admin, who can hide it', async ({ browser }) => {
  const name = `E2E-${Date.now()}`;
  const p = await phone(browser);
  await launch(p, name, 'ขอให้ทดสอบผ่าน');
  await expect(p.locator('#step-done')).toBeVisible({ timeout: 10_000 });
  // cooldown applies right away
  await expect(p.locator('#again-status')).toContainText('ลอยได้อีกครั้งใน');

  const admin = await browser.newPage();
  await admin.goto('/admin/');
  await admin.fill('#email', 'admin@example.com');
  await admin.fill('#password', 'admin1234');
  await admin.click('#login-form button[type=submit]');
  const row = admin.locator('#rows tr', { hasText: name });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole('button', { name: 'ซ่อน' }).click();
  await expect(row).toHaveClass(/hidden-row/);
  await row.getByRole('button', { name: 'แสดง' }).click();
  await expect(row).not.toHaveClass(/hidden-row/);
});

test('inappropriate wishes are blocked before floating', async ({ browser }) => {
  const p = await phone(browser);
  await p.goto('/');
  await p.fill('#name', 'Tester');
  await p.click('#to-decorate');
  await p.click('#to-wish');
  await p.fill('#wish', 'ไอ้เหี้ย');
  await p.click('#launch');
  await expect(p.locator('#launch-status')).toContainText('คำไม่เหมาะสม');
  await expect(p.locator('#step-wish')).toBeVisible();
});

test('floating is disabled while the event is closed', async ({ browser }) => {
  await dbPatch('config', { open: false });
  try {
    const p = await phone(browser);
    await p.goto('/');
    await p.fill('#name', 'Closed');
    await p.click('#to-decorate');
    await p.click('#to-wish');
    await expect(p.locator('#launch-status')).toContainText('ยังไม่เปิด');
    await expect(p.locator('#launch')).toBeDisabled();
  } finally {
    await dbPatch('config', { open: true });
  }
});

test('reactions from a phone reach the krathong owner', async ({ browser }) => {
  const owner = await phone(browser);
  const name = `Owner-${Date.now()}`;
  await launch(owner, name, 'รับหัวใจหน่อย');
  await expect(owner.locator('#step-done')).toBeVisible({ timeout: 10_000 });
  await owner.click('#nav-river');

  const all = await (await fetch(`${DB}/kratongs.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } })).json();
  const id = Object.keys(all).find((key) => all[key].name === name);
  expect(id).toBeTruthy();
  await dbPatch(`reactions/${id}`, { 'some-fan': 'heart' });
  await expect(owner.locator('.mine-card .stats').first()).toContainText('♥ 1', { timeout: 10_000 });
});

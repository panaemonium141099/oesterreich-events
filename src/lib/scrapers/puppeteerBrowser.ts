import type { Browser } from 'puppeteer-core';

let browser: Browser | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  const puppeteer = require('puppeteer-core');
  browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'shell',
    args: ['--no-sandbox', '--disable-http2', '--disable-gpu'],
  });

  return browser!;
}

export async function closeSharedBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch {}
    browser = null;
  }
}

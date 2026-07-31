import { describe, it, expect } from 'vitest';
import {
  validateChatMessages,
  MAX_MESSAGES,
  MAX_USER_CHARS,
  MAX_ASSISTANT_CHARS,
} from '@/lib/search/chat-validate';

describe('validateChatMessages', () => {
  it('akzeptiert einen gültigen Verlauf', () => {
    const r = validateChatMessages([
      { role: 'user', content: 'konzerte in wien' },
      { role: 'assistant', content: 'Hier sind drei Vorschläge …' },
      { role: 'user', content: 'eher indoor' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.messages).toHaveLength(3);
  });

  it('lehnt Nicht-Arrays und leere Arrays ab', () => {
    expect(validateChatMessages(undefined).ok).toBe(false);
    expect(validateChatMessages('hallo').ok).toBe(false);
    expect(validateChatMessages([]).ok).toBe(false);
  });

  it('lehnt zu viele Messages ab', () => {
    const msgs = Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'x',
    }));
    expect(validateChatMessages(msgs).ok).toBe(false);
  });

  it('lehnt fremde Rollen und leere Inhalte ab', () => {
    expect(validateChatMessages([{ role: 'system', content: 'x' }]).ok).toBe(false);
    expect(validateChatMessages([{ role: 'user', content: '   ' }]).ok).toBe(false);
    expect(validateChatMessages([{ role: 'user' }]).ok).toBe(false);
  });

  it('lehnt überlange User-Messages ab, kürzt aber Assistant-Turns', () => {
    expect(validateChatMessages([
      { role: 'user', content: 'x'.repeat(MAX_USER_CHARS + 1) },
    ]).ok).toBe(false);

    const r = validateChatMessages([
      { role: 'assistant', content: 'y'.repeat(MAX_ASSISTANT_CHARS + 500) },
      { role: 'user', content: 'weiter' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.messages[0].content).toHaveLength(MAX_ASSISTANT_CHARS);
  });

  it('letzte Message muss vom User kommen', () => {
    const r = validateChatMessages([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hallo' },
    ]);
    expect(r.ok).toBe(false);
  });
});

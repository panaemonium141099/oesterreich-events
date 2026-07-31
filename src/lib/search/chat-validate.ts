/**
 * chat-validate — Eingabe-Validierung für /api/search/chat (fn-19
 * Phase B). Pur und getestet; der Server ist stateless, der Verlauf
 * kommt IMMER vom Client — deshalb harte Caps gegen Kosten-/
 * Kontext-Aufblähung.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const MAX_MESSAGES = 12;
export const MAX_USER_CHARS = 600;
/** Assistent-Turns (kommen aus unserem eigenen Stream zurück) werden
 *  gekürzt statt abgelehnt — der User kann nichts dafür. */
export const MAX_ASSISTANT_CHARS = 2000;

export type ChatValidation =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string };

export function validateChatMessages(input: unknown): ChatValidation {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'messages required' };
  }
  if (input.length > MAX_MESSAGES) {
    return { ok: false, error: `too many messages (max ${MAX_MESSAGES})` };
  }
  const messages: ChatMessage[] = [];
  for (const raw of input) {
    const role = (raw as { role?: unknown })?.role;
    const content = (raw as { content?: unknown })?.content;
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, error: 'invalid role' };
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, error: 'empty message' };
    }
    if (role === 'user' && content.length > MAX_USER_CHARS) {
      return { ok: false, error: `message too long (max ${MAX_USER_CHARS} chars)` };
    }
    messages.push({
      role,
      content: role === 'assistant' ? content.slice(0, MAX_ASSISTANT_CHARS) : content.trim(),
    });
  }
  if (messages[messages.length - 1].role !== 'user') {
    return { ok: false, error: 'last message must be from user' };
  }
  return { ok: true, messages };
}

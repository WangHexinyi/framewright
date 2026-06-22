import type { ApiConfig, GestureOperation, Message } from '../types';
import { buildComponentPrompt, type ComponentArchitecture, type PromptBuildResult, type PromptCacheEntry } from '../architecture';

const DEFAULT_SYSTEM_PROMPT = `You are Framewright, a senior front-end engineer and product-minded UI designer.

Generate complete, single-file HTML prototypes with:
- valid HTML5
- CSS inside <style>
- optional vanilla JavaScript inside <script>
- no external build step
- desktop-first responsive layout by default
- a primary desktop composition for a 1200px-1440px wide canvas before tablet/mobile fallbacks
- full use of available desktop space with appropriate max-widths, columns, spacing, and visual hierarchy
- stable data-frame-id attributes on meaningful layout and content elements

Do not default to a narrow phone-card layout when the user asks for a desktop UI, interface, landing page, dashboard, profile, business card, or editor canvas. A card can be part of the design, but the overall composition should still feel intentionally placed in a desktop viewport unless the user explicitly asks for mobile.

When updating an existing prototype, preserve every matching data-frame-id exactly. These keys are used by the preview engine to keep DOM state, focus, and visual edits stable.

Return a short note, then exactly one fenced html code block.`;

export const LAYOUT_COMPILE_PROMPT = `You are Framewright's layout compiler.

The user visually edited an AI-generated interface by dragging, resizing, and editing text inside a sandbox. You will receive:
1. The current HTML after temporary visual edits.
2. A structured gesture ledger describing what changed.

Your task:
- Infer the user's layout intent from the gesture ledger.
- Use targetKey/frameId values to identify edited elements. Treat selectorPath only as a fallback diagnostic.
- Replace temporary pixel-level edits with maintainable responsive CSS.
- Prefer flex, grid, gap, padding, margin, max-width, minmax(), clamp(), rem, %, vw/vh where appropriate.
- Remove temporary transform translations caused by dragging.
- Remove temporary inline width/height when they can be expressed as class-level CSS.
- Remove all data-frame-id attributes before final output.
- Preserve the visual design, content, colors, typography, and interactions.
- Return exactly one complete HTML document in a fenced html code block.

Important:
- Do not blindly preserve transform: translate(...) as final layout.
- If the user moved several sibling cards, infer parent layout rules.
- If the user resized an element, infer an intended column width, media size, spacing, or emphasis rule.
- Keep the page responsive for desktop, tablet, and mobile.`;

export function extractHtmlBlock(text: string): string | null {
  const fenceStart = text.search(/```html/i);
  if (fenceStart >= 0) {
    const afterFence = text.slice(fenceStart).replace(/^```html\s*/i, '');
    const fenceEnd = afterFence.indexOf('```');
    const candidate = fenceEnd >= 0 ? afterFence.slice(0, fenceEnd) : afterFence;
    return candidate.trim() || null;
  }

  const doctypeIndex = text.search(/<!doctype html>|<html[\s>]/i);
  if (doctypeIndex >= 0) {
    const candidate = text.slice(doctypeIndex).replace(/```$/g, '').trim();
    return candidate || null;
  }

  return null;
}

export function buildLayoutCompileUserPrompt(
  html: string,
  operations: GestureOperation[],
  architecture?: ComponentArchitecture,
  componentId?: string | null,
): string {
  if (architecture) {
    return buildComponentPrompt({
      architecture,
      componentId: componentId ?? null,
      html,
      operations,
      instruction: LAYOUT_COMPILE_PROMPT,
    }).prompt;
  }

  return `${LAYOUT_COMPILE_PROMPT}

Gesture ledger:
\`\`\`json
${JSON.stringify(operations, null, 2)}
\`\`\`

Current HTML with temporary visual edits:
\`\`\`html
${html}
\`\`\``;
}

export function planLayoutCompilePrompt(
  html: string,
  operations: GestureOperation[],
  architecture: ComponentArchitecture,
  componentId?: string | null,
  cache?: PromptCacheEntry[],
): PromptBuildResult {
  return buildComponentPrompt({
    architecture,
    componentId: componentId ?? null,
    html,
    operations,
    instruction: LAYOUT_COMPILE_PROMPT,
    cache,
  });
}

function contentFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const delta = firstChoice?.delta as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = delta?.content ?? delta?.reasoning_content ?? message?.content ?? record.output_text;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        const item = part as Record<string, unknown>;
        return typeof item.text === 'string' ? item.text : '';
      })
      .join('');
  }

  return '';
}

export async function streamChatCompletion(
  config: ApiConfig,
  messages: Message[],
  onChunk: (chunk: string) => void,
): Promise<string> {
  const useLocalProxy =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) &&
    !config.baseUrl.startsWith('/');
  const response = await fetch(
    useLocalProxy ? '/api/framewright/chat/completions' : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(!useLocalProxy ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      baseUrl: config.baseUrl,
      apiKey: useLocalProxy ? config.apiKey : undefined,
      model: config.model,
      stream: true,
      temperature: 0.7,
      messages: [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...messages],
    }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`API ${response.status}: ${detail || response.statusText}`);
  }

  if (!response.body) throw new Error('Streaming response body is empty.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rawText = '';
  let full = '';
  let sawSse = false;

  function appendChunk(chunk: string) {
    if (!chunk) return;
    full += chunk;
    onChunk(chunk);
  }

  function processLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]') return;
    if (!trimmed.startsWith('data:')) return;

    sawSse = true;
    try {
      const payload = JSON.parse(trimmed.slice(5).trim());
      appendChunk(contentFromPayload(payload));
    } catch {
      // Ignore malformed partial server-sent events.
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const decoded = decoder.decode(value, { stream: true });
    rawText += decoded;
    buffer += decoded;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    lines.forEach(processLine);
  }

  const tail = decoder.decode();
  if (tail) {
    rawText += tail;
    buffer += tail;
  }
  if (buffer.trim()) processLine(buffer);

  if (!sawSse && !full && rawText.trim()) {
    try {
      appendChunk(contentFromPayload(JSON.parse(rawText)));
    } catch {
      appendChunk(rawText);
    }
  }

  return full;
}

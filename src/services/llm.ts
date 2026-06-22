import type { ApiConfig, GestureOperation, Message } from '../types';
import { buildComponentPrompt, type ComponentArchitecture, type PromptBuildResult, type PromptCacheEntry } from '../architecture';

const DEFAULT_SYSTEM_PROMPT = `You are Framewright, a senior front-end engineer and product-minded UI designer.

Generate complete, single-file HTML prototypes with:
- valid HTML5
- CSS inside <style>
- optional vanilla JavaScript inside <script>
- no external build step
- responsive layout by default
- stable data-frame-id attributes on meaningful layout and content elements

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
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const payload = JSON.parse(trimmed.slice(6));
        const chunk = payload.choices?.[0]?.delta?.content ?? '';
        if (chunk) {
          full += chunk;
          onChunk(chunk);
        }
      } catch {
        // Ignore malformed partial server-sent events.
      }
    }
  }

  return full;
}

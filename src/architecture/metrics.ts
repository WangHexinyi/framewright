import type { AiCallMetric, PromptBuildResult } from './types';

export function createAiCallMetric(
  prompt: PromptBuildResult,
  startedAt: number,
  patchApplied: boolean,
): AiCallMetric {
  return {
    id: `metric_${Date.now().toString(36)}`,
    componentId: prompt.componentId,
    route: prompt.route,
    promptChars: prompt.promptChars,
    cacheHit: prompt.cacheHit,
    responseMs: Math.max(0, Date.now() - startedAt),
    patchApplied,
    createdAt: Date.now(),
  };
}

export function summarizeMetrics(metrics: AiCallMetric[]): string {
  if (metrics.length === 0) return 'No AI sync metrics yet.';
  const avgMs = Math.round(metrics.reduce((sum, metric) => sum + metric.responseMs, 0) / metrics.length);
  const avgChars = Math.round(metrics.reduce((sum, metric) => sum + metric.promptChars, 0) / metrics.length);
  const cacheHits = metrics.filter((metric) => metric.cacheHit).length;
  return `${metrics.length} calls | avg ${avgMs}ms | avg ${avgChars} chars | cache hits ${cacheHits}`;
}

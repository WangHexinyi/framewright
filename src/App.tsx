import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PreviewStage } from './components/PreviewStage';
import {
  extractHtmlBlock,
  planLayoutCompilePrompt,
  streamChatCompletion,
} from './services/llm';
import { validateCompiledHtml, type CompileIssue } from './services/validation';
import type { ApiConfig, GestureOperation, Message, SelectedElement } from './types';
import {
  applyComponentPatch,
  applyGestureBatchToHtmlSource,
  buildComponentArchitecture,
  createAiCallMetric,
  createPatchVersion,
  restorePatchVersion,
  summarizeArchitectureCoverage,
  summarizeMetrics,
  type AiCallMetric,
  type PatchVersion,
  type PromptCacheEntry,
  type SourceEditResult,
} from './architecture';

const STORAGE_KEY = 'framewright.apiConfig';
const LAYOUT_STORAGE_KEY = 'framewright.layout';

type CompileState = 'idle' | 'dirty' | 'queued' | 'compiling' | 'synced' | 'synced-local' | 'stale' | 'failed';

const DEFAULT_CONFIG: ApiConfig = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};

type Language = 'en' | 'zh' | 'fr';

const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  zh: '中文',
  fr: 'Français',
};

const COPY = {
  en: {
    tagline: 'Visual gestures compiled into code.',
    generate: 'Generate',
    generateButton: 'Generate interface',
    working: 'Working...',
    shape: 'Shape',
    inspectOn: 'Inspect is on',
    inspectOff: 'Turn on Inspect',
    shapeHint: 'Click to select, drag to move, use the handles to resize, double-click text to edit.',
    style: 'Style',
    styleHint: 'Local edits update the source and preview immediately.',
    colorTarget: 'Color target',
    background: 'Background',
    text: 'Text',
    border: 'Border',
    customColor: 'Custom color',
    radius: 'Corner radius',
    noSelection: 'Select an element to edit color and radius.',
    components: 'Components',
    registered: 'registered components',
    compile: 'Compile',
    recorded: 'recorded gestures',
    autoOn: 'Auto compile on',
    autoOff: 'Auto compile off',
    exportLedger: 'Export ledger',
    clear: 'Clear',
    rollback: 'Roll back last patch',
    clearMetrics: 'Clear metrics',
    askAi: 'Ask AI to compile layout',
    model: 'Model',
    source: 'Source',
    copy: 'Copy',
    copied: 'Copied',
    syncing: 'Syncing',
    modelStream: 'Model stream',
    streamEmpty: 'The latest model response will appear here while streaming.',
    collapsePanel: 'Collapse controls',
    openPanel: 'Open controls',
    closeSource: 'Collapse source',
    openSource: 'Open source',
    syncNudge: 'You have unsaved visual edits. Compile now or enable auto compile before copying/exporting.',
    enableAuto: 'Enable auto compile',
    saveNow: 'Save now',
    selected: 'Selected',
    kindText: 'Text',
    kindButton: 'Button',
    kindGraphic: 'Graphic',
    kindContainer: 'Container',
    kindInput: 'Input',
    kindMedia: 'Media',
  },
  zh: {
    tagline: '把可视化操作编译成代码。',
    generate: '生成',
    generateButton: '生成界面',
    working: '处理中...',
    shape: '塑形',
    inspectOn: '检查模式已开启',
    inspectOff: '开启检查模式',
    shapeHint: '点击选择，拖拽移动，用控制点缩放，双击文字编辑。',
    style: '样式',
    styleHint: '本地修改会立即同步源码和预览。',
    colorTarget: '颜色目标',
    background: '背景',
    text: '文字',
    border: '边框',
    customColor: '自定义颜色',
    radius: '圆角',
    noSelection: '先选择一个元素，再编辑颜色和圆角。',
    components: '组件',
    registered: '个已注册组件',
    compile: '编译',
    recorded: '条已记录操作',
    autoOn: '自动编译已开',
    autoOff: '自动编译已关',
    exportLedger: '导出记录',
    clear: '清空',
    rollback: '回滚上个补丁',
    clearMetrics: '清空指标',
    askAi: '让 AI 编译布局',
    model: '模型',
    source: '源码',
    copy: '复制',
    copied: '已复制',
    syncing: '同步中',
    modelStream: '模型流',
    streamEmpty: '模型流式响应会显示在这里。',
    collapsePanel: '收起控制栏',
    openPanel: '打开控制栏',
    closeSource: '收起源码',
    openSource: '打开源码',
    syncNudge: '你有尚未保存到源码的可视化修改。复制或导出前请先保存，或开启自动编译。',
    enableAuto: '开启自动编译',
    saveNow: '立即保存',
    selected: '当前选中',
    kindText: '文本',
    kindButton: '按钮',
    kindGraphic: '图形',
    kindContainer: '容器',
    kindInput: '输入',
    kindMedia: '媒体',
  },
  fr: {
    tagline: 'Gestes visuels compilés en code.',
    generate: 'Générer',
    generateButton: "Générer l'interface",
    working: 'En cours...',
    shape: 'Modeler',
    inspectOn: 'Inspection activée',
    inspectOff: "Activer l'inspection",
    shapeHint: 'Cliquez pour sélectionner, glissez pour déplacer, utilisez les poignées pour redimensionner, double-cliquez pour modifier le texte.',
    style: 'Style',
    styleHint: 'Les edits locaux mettent à jour la source et l’aperçu immédiatement.',
    colorTarget: 'Cible couleur',
    background: 'Arrière-plan',
    text: 'Texte',
    border: 'Bordure',
    customColor: 'Couleur personnalisée',
    radius: 'Rayon des coins',
    noSelection: 'Sélectionnez un élément pour modifier sa couleur et son rayon.',
    components: 'Composants',
    registered: 'composants enregistrés',
    compile: 'Compiler',
    recorded: 'gestes enregistrés',
    autoOn: 'Compilation auto active',
    autoOff: 'Compilation auto inactive',
    exportLedger: 'Exporter le journal',
    clear: 'Effacer',
    rollback: 'Annuler le dernier patch',
    clearMetrics: 'Effacer les métriques',
    askAi: 'Demander à l’AI de compiler',
    model: 'Modèle',
    source: 'Source',
    copy: 'Copier',
    copied: 'Copié',
    syncing: 'Synchronisation',
    modelStream: 'Flux modèle',
    streamEmpty: 'La dernière réponse du modèle apparaîtra ici.',
    collapsePanel: 'Réduire les contrôles',
    openPanel: 'Ouvrir les contrôles',
    closeSource: 'Réduire la source',
    openSource: 'Ouvrir la source',
    syncNudge: 'Vous avez des edits visuels non enregistrés. Compilez maintenant ou activez la compilation auto avant de copier/exporter.',
    enableAuto: 'Activer auto',
    saveNow: 'Enregistrer',
    selected: 'Sélection',
    kindText: 'Texte',
    kindButton: 'Bouton',
    kindGraphic: 'Forme',
    kindContainer: 'Conteneur',
    kindInput: 'Champ',
    kindMedia: 'Média',
  },
} satisfies Record<Language, Record<string, string>>;

const DEFAULT_COLORS = ['#211c18', '#ffffff', '#bf5b3a', '#8e3f27', '#ffcf9f', '#f7f1e8', '#3b82f6', '#22c55e'];

const KIND_COPY_KEYS = {
  text: 'kindText',
  button: 'kindButton',
  graphic: 'kindGraphic',
  container: 'kindContainer',
  input: 'kindInput',
  media: 'kindMedia',
} as const;

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Framewright Starter</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f1e8;
      color: #211c18;
    }
    main {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 48px 24px;
    }
    .card {
      width: min(920px, 100%);
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 28px;
      align-items: center;
      padding: 36px;
      border: 1px solid #e3d6c7;
      border-radius: 28px;
      background: rgba(255, 252, 247, .86);
      box-shadow: 0 24px 80px rgba(64, 45, 28, .12);
    }
    .eyebrow {
      margin: 0 0 12px;
      color: #a55335;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(42px, 7vw, 84px);
      line-height: .9;
      letter-spacing: -.06em;
    }
    p {
      max-width: 58ch;
      color: #6e6259;
      font-size: 18px;
      line-height: 1.7;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 14px 22px;
      background: #211c18;
      color: white;
      font: inherit;
      font-weight: 700;
    }
    .visual {
      min-height: 280px;
      border-radius: 24px;
      background:
        radial-gradient(circle at 30% 25%, #ffcf9f 0 16%, transparent 17%),
        radial-gradient(circle at 70% 70%, #bf5b3a 0 18%, transparent 19%),
        linear-gradient(135deg, #f8e0c6, #fffaf2);
      border: 1px solid #ecd8c1;
    }
    @media (max-width: 760px) {
      .card { grid-template-columns: 1fr; padding: 24px; }
      .visual { min-height: 180px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <div>
        <p class="eyebrow">Framewright demo</p>
        <h1>Shape first. Code follows.</h1>
        <p>Turn on Inspect, drag or resize the elements, then ask the AI to compile those gestures into clean responsive CSS.</p>
        <button>Start shaping</button>
      </div>
      <div class="visual" aria-label="abstract product visual"></div>
    </section>
  </main>
</body>
</html>`;

function readConfig(): ApiConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function readLayout(): { leftPanelOpen: boolean; codePanelOpen: boolean; codePanelWidth: number } {
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return { leftPanelOpen: true, codePanelOpen: true, codePanelWidth: 420 };
    const parsed = JSON.parse(saved) as Partial<{ leftPanelOpen: boolean; codePanelOpen: boolean; codePanelWidth: number }>;
    return {
      leftPanelOpen: parsed.leftPanelOpen ?? true,
      codePanelOpen: parsed.codePanelOpen ?? true,
      codePanelWidth: Math.min(760, Math.max(320, parsed.codePanelWidth ?? 420)),
    };
  } catch {
    return { leftPanelOpen: true, codePanelOpen: true, codePanelWidth: 420 };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightHtmlCode(value: string): string {
  return escapeHtml(value)
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-comment">$1</span>')
    .replace(/(&lt;\/?)([a-zA-Z][\w:-]*)/g, '$1<span class="tok-tag">$2</span>')
    .replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(=)(&quot;.*?&quot;|'.*?'|&quot;.*?$)/g, '<span class="tok-attr">$1</span>$2<span class="tok-string">$3</span>')
    .replace(/(#(?:[0-9a-fA-F]{3}){1,2})/g, '<span class="tok-color">$1</span>');
}

function measureCodeDelta(before: string, after: string): { added: number; deleted: number } {
  if (before === after) return { added: 0, deleted: 0 };
  const previous = before.split('\n');
  const next = after.split('\n');
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix + prefix < previous.length &&
    suffix + prefix < next.length &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return {
    added: Math.max(0, next.length - prefix - suffix),
    deleted: Math.max(0, previous.length - prefix - suffix),
  };
}

function localSourceMetric(result: SourceEditResult): AiCallMetric {
  return {
    id: `metric_${Date.now().toString(36)}`,
    componentId: result.actionId,
    route: result.route,
    promptChars: 0,
    cacheHit: true,
    responseMs: result.elapsedMs,
    patchApplied: result.applied,
    createdAt: Date.now(),
  };
}

function App() {
  const [config, setConfig] = useState<ApiConfig>(readConfig);
  const initialLayout = useMemo(() => readLayout(), []);
  const [language, setLanguage] = useState<Language>('en');
  const [prompt, setPrompt] = useState('Design a premium landing page for a calm AI writing app.');
  const [code, setCode] = useState(STARTER_HTML);
  const [messages, setMessages] = useState<Message[]>([]);
  const [operations, setOperations] = useState<GestureOperation[]>([]);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [colorTarget, setColorTarget] = useState<'background' | 'color' | 'border-color'>('background');
  const [customColor, setCustomColor] = useState('#bf5b3a');
  const [cornerRadius, setCornerRadius] = useState(24);
  const [leftPanelOpen, setLeftPanelOpen] = useState(initialLayout.leftPanelOpen);
  const [codePanelOpen, setCodePanelOpen] = useState(initialLayout.codePanelOpen);
  const [codePanelWidth, setCodePanelWidth] = useState(initialLayout.codePanelWidth);
  const [inspectMode, setInspectMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [compileIssues, setCompileIssues] = useState<CompileIssue[]>([]);
  const [autoCompileEnabled, setAutoCompileEnabled] = useState(false);
  const [compileState, setCompileState] = useState<CompileState>('idle');
  const [patchVersions, setPatchVersions] = useState<PatchVersion[]>([]);
  const [aiMetrics, setAiMetrics] = useState<AiCallMetric[]>([]);
  const [promptCache, setPromptCache] = useState<PromptCacheEntry[]>([]);
  const compileVersionRef = useRef(0);
  const activeCompileRef = useRef(false);
  const autoCompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appShellRef = useRef<HTMLElement | null>(null);
  const codeHighlightRef = useRef<HTMLPreElement | null>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const codeAutoFollowRef = useRef(true);
  const pendingStreamCodeRef = useRef('');
  const streamCodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousCodeRef = useRef(STARTER_HTML);
  const [codeDelta, setCodeDelta] = useState({ added: 0, deleted: 0 });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ leftPanelOpen, codePanelOpen, codePanelWidth }));
  }, [leftPanelOpen, codePanelOpen, codePanelWidth]);

  useEffect(() => {
    const previous = previousCodeRef.current;
    setCodeDelta(measureCodeDelta(previous, code));
    previousCodeRef.current = code;
  }, [code]);

  const hasApiKey = config.apiKey.trim().length > 0;
  const architecture = useMemo(() => buildComponentArchitecture(code, 'framewright'), [code]);
  const architectureCoverage = useMemo(
    () => summarizeArchitectureCoverage(architecture.registry, architecture.scopedCss),
    [architecture],
  );
  const t = COPY[language];
  const operationCountByType = useMemo(() => {
    return operations.reduce<Record<string, number>>((acc, operation) => {
      acc[operation.type] = (acc[operation.type] ?? 0) + 1;
      return acc;
    }, {});
  }, [operations]);

  const highlightedCode = useMemo(() => highlightHtmlCode(code), [code]);

  const syncCodeScroll = useCallback(() => {
    const textarea = codeTextareaRef.current;
    const highlight = codeHighlightRef.current;
    if (!textarea || !highlight) return;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }, []);

  const scrollCodeToBottom = useCallback(() => {
    const textarea = codeTextareaRef.current;
    const highlight = codeHighlightRef.current;
    if (!textarea) return;
    textarea.scrollTop = textarea.scrollHeight;
    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  }, []);

  useEffect(() => {
    if (!codePanelOpen || !codeAutoFollowRef.current) return;
    requestAnimationFrame(scrollCodeToBottom);
  }, [code, codePanelOpen, scrollCodeToBottom]);

  useEffect(() => {
    return () => {
      if (streamCodeTimerRef.current) window.clearTimeout(streamCodeTimerRef.current);
    };
  }, []);

  const handleCodeChange = useCallback((nextCode: string) => {
    compileVersionRef.current += 1;
    setCode(nextCode);
    setCompileIssues([]);
    setCompileState('dirty');
  }, []);

  const handleOperation = useCallback((operation: GestureOperation) => {
    compileVersionRef.current += 1;
    setOperations((prev) => {
      const latest = prev[0];
      if (
        latest &&
        latest.type === operation.type &&
        latest.type !== 'editText' &&
        latest.frameId === operation.frameId
      ) {
        return [
          {
            ...operation,
            before: latest.before,
          },
          ...prev.slice(1),
        ].slice(0, 80);
      }
      return [operation, ...prev].slice(0, 80);
    });
    setCompileIssues([]);
    setCompileState(autoCompileEnabled ? 'queued' : 'dirty');
  }, [autoCompileEnabled]);

  const applySelectedStyle = useCallback((property: string, value: string) => {
    if (!selectedElement) {
      setError(t.noSelection);
      return;
    }

    const styleOperation: GestureOperation = {
      id: `style_${Date.now().toString(36)}`,
      type: 'style',
      targetKey: selectedElement.frameId,
      blockId: selectedElement.blockId,
      componentId: selectedElement.componentId || selectedElement.blockId,
      componentPath: selectedElement.componentPath,
      version: Date.now(),
      frameId: selectedElement.frameId,
      tagName: selectedElement.tagName,
      selectorPath: selectedElement.selectorPath,
      before: null,
      after: null,
      styleChange: { property, after: value },
      inlineStyleAfter: '',
      context: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        parent: null,
        layoutHint: {
          intent: 'direct style control',
          reason: 'User changed a deterministic visual style through the local style panel.',
          siblingCount: 0,
        },
      },
      createdAt: Date.now(),
    };

    const sourceEdit = applyGestureBatchToHtmlSource(code, [styleOperation], architecture);
    if (!sourceEdit.applied) {
      setCompileIssues(sourceEdit.issues);
      setCompileState('failed');
      return;
    }

    compileVersionRef.current += 1;
    setPatchVersions((prev) => [
      createPatchVersion(architecture, sourceEdit.actionId, code, `local style ${property}`),
      ...prev,
    ].slice(0, 20));
    setCode(sourceEdit.code);
    setCompileIssues([...sourceEdit.issues, ...validateCompiledHtml(sourceEdit.code)]);
    setAiMetrics((prev) => [localSourceMetric(sourceEdit), ...prev].slice(0, 50));
    setOperations([]);
    setCompileState('synced-local');
    setError(null);
  }, [architecture, code, selectedElement, t.noSelection]);

  async function runAi(nextMessages: Message[], streamToCode = true) {
    if (!hasApiKey) {
      setError('Add an OpenAI-compatible API key before calling the model.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setStreamText('');
    codeAutoFollowRef.current = true;
    if (streamCodeTimerRef.current) {
      window.clearTimeout(streamCodeTimerRef.current);
      streamCodeTimerRef.current = null;
    }

    try {
      let streamed = '';
      const response = await streamChatCompletion(config, nextMessages, (chunk) => {
        streamed += chunk;
        setStreamText(streamed);
        const partialHtml = extractHtmlBlock(streamed);
        if (partialHtml && streamToCode) {
          pendingStreamCodeRef.current = partialHtml;
          if (!streamCodeTimerRef.current) {
            streamCodeTimerRef.current = window.setTimeout(() => {
              streamCodeTimerRef.current = null;
              setCode(pendingStreamCodeRef.current);
            }, 180);
          }
        }
      });

      const html = extractHtmlBlock(response);
      if (streamCodeTimerRef.current) {
        window.clearTimeout(streamCodeTimerRef.current);
        streamCodeTimerRef.current = null;
      }
      if (html && streamToCode) setCode(html);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown API error.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate() {
    const userMessage: Message = {
      role: 'user',
      content: `${prompt}

Target viewport: desktop canvas first, roughly 1200px-1440px wide. Use the available width intentionally; do not return a narrow mobile-style card unless the user explicitly requested mobile.

Return a complete responsive single-file HTML prototype.`,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    const response = await runAi(nextMessages);
    if (response) {
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      setOperations([]);
      setCompileIssues([]);
      setCompileState('synced');
    }
  }

  async function handleCompileLayout() {
    if (operations.length === 0) {
      setError('No gestures recorded yet. Turn on Inspect, then move or resize something first.');
      return;
    }

    const orderedOperations = operations.slice().reverse();
    const sourceEdit = applyGestureBatchToHtmlSource(code, orderedOperations, architecture);
    if (sourceEdit.applied) {
      setPatchVersions((prev) => [
        createPatchVersion(architecture, sourceEdit.actionId, code, 'local source AST edit'),
        ...prev,
      ].slice(0, 20));
      setCode(sourceEdit.code);
      setCompileIssues([...sourceEdit.issues, ...validateCompiledHtml(sourceEdit.code)]);
      setAiMetrics((prev) => [localSourceMetric(sourceEdit), ...prev].slice(0, 50));
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: `Saved ${orderedOperations.length} source AST edits without AI.` },
      ]);
      setOperations([]);
      setInspectMode(false);
      setSelectedElement(null);
      setCompileState('synced-local');
      return;
    }

    const promptPlan = planLayoutCompilePrompt(
      code,
      orderedOperations,
      architecture,
      selectedElement?.componentId || selectedElement?.blockId || operations[0]?.componentId || operations[0]?.blockId,
      promptCache,
    );
    const startedAt = Date.now();
    setPatchVersions((prev) => [
      createPatchVersion(architecture, promptPlan.componentId, code, 'manual compile'),
      ...prev,
    ].slice(0, 20));

    const userMessage: Message = {
      role: 'user',
      content: promptPlan.prompt,
    };
    const response = await runAi([...messages.slice(-4), userMessage], false);

    if (response) {
      const html = extractHtmlBlock(response);
      if (html) {
        const patched = applyComponentPatch(architecture.html, promptPlan.blockId, html);
        const nextCode = patched || (/<html[\s>]|<!doctype html>/i.test(html) ? html : code);
        setCode(nextCode);
        setCompileIssues(validateCompiledHtml(nextCode));
        setPromptCache((prev) => [
          { key: promptPlan.cacheKey, prompt: promptPlan.prompt, response, createdAt: Date.now() },
          ...prev,
        ].slice(0, 30));
        setAiMetrics((prev) => [createAiCallMetric(promptPlan, startedAt, Boolean(patched || html)), ...prev].slice(0, 50));
      }
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: 'Compile my visual edits into clean responsive layout code.' },
        { role: 'assistant', content: response },
      ]);
      setOperations([]);
      setInspectMode(false);
      setSelectedElement(null);
      setCompileState('synced');
    }
  }

  const runBackgroundCompile = useCallback(async () => {
    if (operations.length === 0 || activeCompileRef.current) return;
    const orderedOperations = operations.slice().reverse();
    const sourceEdit = applyGestureBatchToHtmlSource(code, orderedOperations, architecture);
    if (sourceEdit.applied) {
      setPatchVersions((prev) => [
        createPatchVersion(architecture, sourceEdit.actionId, code, 'background local source AST edit'),
        ...prev,
      ].slice(0, 20));
      setCode(sourceEdit.code);
      setCompileIssues([...sourceEdit.issues, ...validateCompiledHtml(sourceEdit.code)]);
      setAiMetrics((prev) => [localSourceMetric(sourceEdit), ...prev].slice(0, 50));
      setOperations([]);
      setCompileState('synced-local');
      return;
    }
    if (!hasApiKey) {
      setCompileState('failed');
      return;
    }

    const promptPlan = planLayoutCompilePrompt(
      code,
      orderedOperations,
      architecture,
      selectedElement?.componentId || selectedElement?.blockId || operations[0]?.componentId || operations[0]?.blockId,
      promptCache,
    );
    const startedVersion = compileVersionRef.current;
    const startedAt = Date.now();
    const userMessage: Message = {
      role: 'user',
      content: promptPlan.prompt,
    };

    activeCompileRef.current = true;
    setCompileState('compiling');
    setError(null);

    try {
      const response = await streamChatCompletion(config, [...messages.slice(-4), userMessage], () => {
        // Keep the live canvas uninterrupted during background compilation.
      });
      const html = extractHtmlBlock(response);

      if (!html) {
        setCompileState('failed');
        return;
      }

      if (compileVersionRef.current === startedVersion) {
        const patched = applyComponentPatch(architecture.html, promptPlan.blockId, html);
        const nextCode = patched || (/<html[\s>]|<!doctype html>/i.test(html) ? html : code);
        setPatchVersions((prev) => [
          createPatchVersion(architecture, promptPlan.componentId, code, 'background compile'),
          ...prev,
        ].slice(0, 20));
        setCode(nextCode);
        setCompileIssues(validateCompiledHtml(nextCode));
        setPromptCache((prev) => [
          { key: promptPlan.cacheKey, prompt: promptPlan.prompt, response, createdAt: Date.now() },
          ...prev,
        ].slice(0, 30));
        setAiMetrics((prev) => [createAiCallMetric(promptPlan, startedAt, Boolean(patched || html)), ...prev].slice(0, 50));
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: 'Background compile visual edits into clean responsive code.' },
          { role: 'assistant', content: response },
        ]);
        setOperations([]);
        setCompileState('synced');
      } else {
        setCompileState('stale');
      }
    } catch (err) {
      setCompileState('failed');
      setError(err instanceof Error ? err.message : 'Background compile failed.');
    } finally {
      activeCompileRef.current = false;
      if (compileVersionRef.current !== startedVersion && autoCompileEnabled) {
        setCompileState('queued');
      }
    }
  }, [architecture, autoCompileEnabled, code, config, hasApiKey, messages, operations, promptCache, selectedElement]);

  useEffect(() => {
    if (!autoCompileEnabled || operations.length === 0 || activeCompileRef.current) return;
    if (compileState !== 'dirty' && compileState !== 'queued' && compileState !== 'stale') return;

    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current);
    }

    autoCompileTimerRef.current = setTimeout(() => {
      void runBackgroundCompile();
    }, 1200);

    return () => {
      if (autoCompileTimerRef.current) {
        clearTimeout(autoCompileTimerRef.current);
      }
    };
  }, [autoCompileEnabled, compileState, operations, runBackgroundCompile]);

  function handleExportLedger() {
    const payload = JSON.stringify(operations.slice().reverse(), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `framewright-gesture-ledger-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleRollback() {
    const [latest, ...rest] = patchVersions;
    if (!latest) return;
    compileVersionRef.current += 1;
    setCode(restorePatchVersion(latest));
    setPatchVersions(rest);
    setOperations([]);
    setCompileIssues([]);
    setCompileState('idle');
  }

  async function handleCopyCode() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed.');
    }
  }

  function beginSourceResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const shell = appShellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();

    function move(pointerEvent: PointerEvent) {
      const next = rect.right - pointerEvent.clientX - 12;
      setCodePanelWidth(Math.min(760, Math.max(320, next)));
    }

    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing-workspace');
    }

    document.body.classList.add('resizing-workspace');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const selectedKindLabel = selectedElement?.elementKind
    ? t[KIND_COPY_KEYS[selectedElement.elementKind]]
    : '';
  const shellStyle = {
    '--left-panel-width': leftPanelOpen ? '340px' : '0px',
    '--code-panel-width': `${codePanelWidth}px`,
  } as CSSProperties;

  return (
    <main
      ref={appShellRef}
      className={[
        'app-shell',
        leftPanelOpen ? '' : 'left-collapsed',
        codePanelOpen ? '' : 'code-collapsed',
      ].filter(Boolean).join(' ')}
      style={shellStyle}
    >
      {!leftPanelOpen && (
        <button
          type="button"
          className="drawer-tab"
          onClick={() => setLeftPanelOpen(true)}
          aria-label={t.openPanel}
          title={t.openPanel}
        >
          Fw
        </button>
      )}
      <aside className="control-panel" aria-hidden={!leftPanelOpen}>
        <header className="brand">
          <h1>Framewright</h1>
          <button
            type="button"
            className="panel-collapse-button"
            onClick={() => setLeftPanelOpen(false)}
            aria-label={t.collapsePanel}
            title={t.collapsePanel}
          >
            {'<'}
          </button>
        </header>

        <label className="language-control">
          Language
          <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <section className="panel-section">
          <div className="section-heading">
            <span>1</span>
            <h2>{t.generate}</h2>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="prompt-box"
            rows={5}
          />
          <button className="primary-button" type="button" onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? t.working : t.generateButton}
          </button>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>2</span>
            <h2>{t.shape}</h2>
          </div>
          <button
            type="button"
            className={inspectMode ? 'toggle-button active' : 'toggle-button'}
            onClick={() => setInspectMode((value) => !value)}
          >
            {inspectMode ? t.inspectOn : t.inspectOff}
          </button>
          <p className="hint">{t.shapeHint}</p>
          {selectedElement && (
            <div className={`selected-card kind-${selectedElement.elementKind || 'container'}`}>
              <div className="selected-card-header">
                <span>{t.selected}</span>
                <strong>{selectedKindLabel}</strong>
              </div>
              <div className="selected-card-tag">
                <strong>{`<${selectedElement.tagName}>`}</strong>
                <span>{selectedElement.textContent || selectedElement.selectorPath}</span>
              </div>
              <span>{selectedElement.blockId || selectedElement.frameId}</span>
            </div>
          )}
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>3</span>
            <h2>{t.style}</h2>
          </div>
          <p className="hint">{selectedElement ? t.styleHint : t.noSelection}</p>
          <label>
            {t.colorTarget}
            <select
              value={colorTarget}
              onChange={(event) => setColorTarget(event.target.value as typeof colorTarget)}
              disabled={!selectedElement}
            >
              <option value="background">{t.background}</option>
              <option value="color">{t.text}</option>
              <option value="border-color">{t.border}</option>
            </select>
          </label>
          <div className="color-swatches" aria-label={t.colorTarget}>
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                style={{ backgroundColor: color }}
                disabled={!selectedElement}
                onClick={() => {
                  setCustomColor(color);
                  applySelectedStyle(colorTarget, color);
                }}
              />
            ))}
          </div>
          <label>
            {t.customColor}
            <input
              type="color"
              value={customColor}
              disabled={!selectedElement}
              onChange={(event) => {
                setCustomColor(event.target.value);
                applySelectedStyle(colorTarget, event.target.value);
              }}
            />
          </label>
          <label>
            {`${t.radius}: ${cornerRadius}px`}
            <input
              type="range"
              min="0"
              max="80"
              value={cornerRadius}
              disabled={!selectedElement}
              onChange={(event) => {
                const next = Number(event.target.value);
                setCornerRadius(next);
                applySelectedStyle('border-radius', `${next}px`);
              }}
            />
          </label>
          <input
            type="number"
            min="0"
            max="240"
            value={cornerRadius}
            disabled={!selectedElement}
            aria-label={t.radius}
            onChange={(event) => {
              const next = Math.max(0, Number(event.target.value) || 0);
              setCornerRadius(next);
              applySelectedStyle('border-radius', `${next}px`);
            }}
          />
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>Tree</span>
            <h2>{t.components}</h2>
          </div>
          <div className="ledger-summary">
            <div>
              <strong>{architectureCoverage.registryEntries}</strong>
              <span>{t.registered}</span>
            </div>
            <div className="ledger-pills">
              <span>css {architectureCoverage.scopedCssBlocks}</span>
              <span>mapped {architecture.shadowMap.length}</span>
              <span>{architecture.manifest.modules.length} modules</span>
            </div>
          </div>
          <ol className="ledger-list" aria-label="Component tree">
            {architecture.registry.slice(1, 6).map((entry) => (
              <li key={entry.id}>
                <strong>{entry.tagName}</strong>
                <span title={entry.blockId}>{entry.blockId}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>4</span>
            <h2>{t.compile}</h2>
          </div>
          <div className="ledger-summary">
            <div>
              <strong>{operations.length}</strong>
              <span>{t.recorded}</span>
            </div>
            <div className="ledger-pills">
              <span>move {operationCountByType.move ?? 0}</span>
              <span>resize {operationCountByType.resize ?? 0}</span>
              <span>text {operationCountByType.editText ?? 0}</span>
              <span>style {operationCountByType.style ?? 0}</span>
            </div>
          </div>
          <div className={`compile-status state-${compileState}`}>
            <button
              type="button"
              className={autoCompileEnabled ? 'auto-compile active' : 'auto-compile'}
              onClick={() => setAutoCompileEnabled((value) => !value)}
            >
              {autoCompileEnabled ? t.autoOn : t.autoOff}
            </button>
            <span>
              {compileState === 'idle' && 'Code is ready.'}
              {compileState === 'dirty' && 'Visual edits are not compiled yet.'}
              {compileState === 'queued' && 'Waiting for you to pause.'}
              {compileState === 'compiling' && 'AI is compiling in the background.'}
              {compileState === 'synced' && 'Code has caught up.'}
              {compileState === 'synced-local' && 'Source AST updated locally.'}
              {compileState === 'stale' && 'New edits arrived during compile.'}
              {compileState === 'failed' && 'Compile needs attention.'}
            </span>
          </div>
          <div className="ledger-actions">
            <button type="button" onClick={handleExportLedger} disabled={operations.length === 0}>
              {t.exportLedger}
            </button>
            <button type="button" onClick={() => setOperations([])} disabled={operations.length === 0}>
              {t.clear}
            </button>
          </div>
          <div className="ledger-actions">
            <button type="button" onClick={handleRollback} disabled={patchVersions.length === 0}>
              {t.rollback}
            </button>
            <button type="button" onClick={() => setAiMetrics([])} disabled={aiMetrics.length === 0}>
              {t.clearMetrics}
            </button>
          </div>
          <p className="hint">{summarizeMetrics(aiMetrics)}</p>
          {operations.length > 0 && (
            <ol className="ledger-list" aria-label="Recent gesture operations">
              {operations.slice(0, 5).map((operation) => (
                <li key={operation.id}>
                  <strong>{operation.type}</strong>
                  <span>{`<${operation.tagName}>`}</span>
                </li>
              ))}
            </ol>
          )}
          <button
            className="compile-button"
            type="button"
            onClick={handleCompileLayout}
            disabled={isLoading || operations.length === 0}
          >
            {t.askAi}
          </button>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>API</span>
            <h2>{t.model}</h2>
          </div>
          <label>
            Base URL
            <input
              value={config.baseUrl}
              onChange={(event) => setConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
          </label>
          <label>
            Model
            <input
              value={config.model}
              onChange={(event) => setConfig((prev) => ({ ...prev, model: event.target.value }))}
            />
          </label>
          <label>
            API key
            <input
              value={config.apiKey}
              type="password"
              placeholder="Stored locally in this browser"
              onChange={(event) => setConfig((prev) => ({ ...prev, apiKey: event.target.value }))}
            />
          </label>
        </section>

        {error && <div className="error-box">{error}</div>}
        {compileIssues.length > 0 && (
          <div className="issues-box">
            <strong>Compile checks</strong>
            <ul>
              {compileIssues.map((issue) => (
                <li key={issue.message} className={issue.severity}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <div className="preview-slot">
        <PreviewStage
          code={code}
          inspectMode={inspectMode}
          deferPreviewSync={autoCompileEnabled && !isLoading}
          onCodeChange={handleCodeChange}
          onOperation={handleOperation}
          onSelectElement={setSelectedElement}
        />
      </div>

      {operations.length > 0 && !autoCompileEnabled && (
        <div className="sync-nudge" role="status">
          <span>{t.syncNudge}</span>
          <button type="button" onClick={() => setAutoCompileEnabled(true)}>
            {t.enableAuto}
          </button>
          <button type="button" onClick={() => void handleCompileLayout()}>
            {t.saveNow}
          </button>
        </div>
      )}

      <div className="code-delta-lens" aria-live="polite">
        <span className="delta-added">{`+${codeDelta.added}`}</span>
        <span className="delta-deleted">{`-${codeDelta.deleted}`}</span>
      </div>

      {!codePanelOpen && (
        <button
          type="button"
          className="source-tab"
          onClick={() => setCodePanelOpen(true)}
          aria-label={t.openSource}
          title={t.openSource}
        >
          {'</>'}
        </button>
      )}

      {codePanelOpen && (
        <button
          type="button"
          className="workspace-resizer"
          onPointerDown={beginSourceResize}
          aria-label="Resize source panel"
          title="Drag to resize source panel"
        />
      )}

      <aside className="code-panel" aria-hidden={!codePanelOpen}>
        <header>
          <h2>{t.source}</h2>
          <div className="code-actions">
            <button type="button" className="copy-code-button" onClick={() => void handleCopyCode()}>
              {copyState === 'copied' ? t.copied : t.copy}
            </button>
            <button
              type="button"
              className="panel-collapse-button"
              onClick={() => setCodePanelOpen(false)}
              aria-label={t.closeSource}
              title={t.closeSource}
            >
              {'>'}
            </button>
          </div>
        </header>
        <div className="code-editor">
          <pre
            ref={codeHighlightRef}
            className="code-highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
          <textarea
            ref={codeTextareaRef}
            value={code}
            onChange={(event) => handleCodeChange(event.target.value)}
            onScroll={(event) => {
              const textarea = event.currentTarget;
              const distanceFromBottom = textarea.scrollHeight - textarea.clientHeight - textarea.scrollTop;
              codeAutoFollowRef.current = distanceFromBottom < 24;
              syncCodeScroll();
            }}
            spellCheck={false}
          />
        </div>
        <div className="stream-box">
          <strong>{t.modelStream}</strong>
          <p>{streamText || t.streamEmpty}</p>
        </div>
      </aside>
    </main>
  );
}

export default App;

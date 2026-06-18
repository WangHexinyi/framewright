import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PreviewStage } from './components/PreviewStage';
import {
  buildLayoutCompileUserPrompt,
  extractHtmlBlock,
  streamChatCompletion,
} from './services/llm';
import { validateCompiledHtml, type CompileIssue } from './services/validation';
import type { ApiConfig, GestureOperation, Message, SelectedElement } from './types';

const STORAGE_KEY = 'framewright.apiConfig';

type CompileState = 'idle' | 'dirty' | 'queued' | 'compiling' | 'synced' | 'stale' | 'failed';

const DEFAULT_CONFIG: ApiConfig = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};

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

function App() {
  const [config, setConfig] = useState<ApiConfig>(readConfig);
  const [prompt, setPrompt] = useState('Design a premium landing page for a calm AI writing app.');
  const [code, setCode] = useState(STARTER_HTML);
  const [messages, setMessages] = useState<Message[]>([]);
  const [operations, setOperations] = useState<GestureOperation[]>([]);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [compileIssues, setCompileIssues] = useState<CompileIssue[]>([]);
  const [autoCompileEnabled, setAutoCompileEnabled] = useState(false);
  const [compileState, setCompileState] = useState<CompileState>('idle');
  const compileVersionRef = useRef(0);
  const activeCompileRef = useRef(false);
  const autoCompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const hasApiKey = config.apiKey.trim().length > 0;
  const operationCountByType = useMemo(() => {
    return operations.reduce<Record<string, number>>((acc, operation) => {
      acc[operation.type] = (acc[operation.type] ?? 0) + 1;
      return acc;
    }, {});
  }, [operations]);

  const handleCodeChange = useCallback((nextCode: string) => {
    compileVersionRef.current += 1;
    setCode(nextCode);
    setCompileIssues([]);
    setCompileState('dirty');
  }, []);

  const handleOperation = useCallback((operation: GestureOperation) => {
    compileVersionRef.current += 1;
    setOperations((prev) => [operation, ...prev].slice(0, 80));
    setCompileIssues([]);
    setCompileState(autoCompileEnabled ? 'queued' : 'dirty');
  }, [autoCompileEnabled]);

  async function runAi(nextMessages: Message[]) {
    if (!hasApiKey) {
      setError('Add an OpenAI-compatible API key before calling the model.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setStreamText('');

    try {
      let streamed = '';
      const response = await streamChatCompletion(config, nextMessages, (chunk) => {
        streamed += chunk;
        setStreamText(streamed);
        const partialHtml = extractHtmlBlock(streamed);
        if (partialHtml) setCode(partialHtml);
      });

      const html = extractHtmlBlock(response);
      if (html) setCode(html);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown API error.');
      return null;
    } finally {
      setIsLoading(false);
      setStreamText('');
    }
  }

  async function handleGenerate() {
    const userMessage: Message = {
      role: 'user',
      content: `${prompt}

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

    const userMessage: Message = {
      role: 'user',
      content: buildLayoutCompileUserPrompt(code, operations.slice().reverse()),
    };
    const response = await runAi([...messages.slice(-4), userMessage]);

    if (response) {
      const html = extractHtmlBlock(response);
      if (html) {
        setCompileIssues(validateCompiledHtml(html));
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
    if (!hasApiKey) {
      setCompileState('failed');
      return;
    }

    const startedVersion = compileVersionRef.current;
    const userMessage: Message = {
      role: 'user',
      content: buildLayoutCompileUserPrompt(code, operations.slice().reverse()),
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
        setCode(html);
        setCompileIssues(validateCompiledHtml(html));
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
  }, [autoCompileEnabled, code, config, hasApiKey, messages, operations]);

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

  const isCodeExportLocked = operations.length > 0 || compileState === 'queued' || compileState === 'compiling' || compileState === 'stale';

  return (
    <main className="app-shell">
      <aside className="control-panel">
        <header className="brand">
          <div className="brand-mark">Fw</div>
          <div>
            <h1>Framewright</h1>
            <p>Visual gestures compiled into code.</p>
          </div>
        </header>

        <section className="panel-section">
          <div className="section-heading">
            <span>1</span>
            <h2>Generate</h2>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="prompt-box"
            rows={5}
          />
          <button className="primary-button" type="button" onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? 'Working...' : 'Generate interface'}
          </button>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>2</span>
            <h2>Shape</h2>
          </div>
          <button
            type="button"
            className={inspectMode ? 'toggle-button active' : 'toggle-button'}
            onClick={() => setInspectMode((value) => !value)}
          >
            {inspectMode ? 'Inspect is on' : 'Turn on Inspect'}
          </button>
          <p className="hint">
            Click to select, drag to move, use the handle to resize, double-click text to edit.
          </p>
          {selectedElement && (
            <div className="selected-card">
              <strong>{`<${selectedElement.tagName}>`}</strong>
              <span>{selectedElement.textContent || selectedElement.selectorPath}</span>
            </div>
          )}
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>3</span>
            <h2>Compile</h2>
          </div>
          <div className="ledger-summary">
            <div>
              <strong>{operations.length}</strong>
              <span>recorded gestures</span>
            </div>
            <div className="ledger-pills">
              <span>move {operationCountByType.move ?? 0}</span>
              <span>resize {operationCountByType.resize ?? 0}</span>
              <span>text {operationCountByType.editText ?? 0}</span>
            </div>
          </div>
          <div className={`compile-status state-${compileState}`}>
            <button
              type="button"
              className={autoCompileEnabled ? 'auto-compile active' : 'auto-compile'}
              onClick={() => setAutoCompileEnabled((value) => !value)}
            >
              {autoCompileEnabled ? 'Auto compile on' : 'Auto compile off'}
            </button>
            <span>
              {compileState === 'idle' && 'Code is ready.'}
              {compileState === 'dirty' && 'Visual edits are not compiled yet.'}
              {compileState === 'queued' && 'Waiting for you to pause.'}
              {compileState === 'compiling' && 'AI is compiling in the background.'}
              {compileState === 'synced' && 'Code has caught up.'}
              {compileState === 'stale' && 'New edits arrived during compile.'}
              {compileState === 'failed' && 'Compile needs attention.'}
            </span>
          </div>
          <div className="ledger-actions">
            <button type="button" onClick={handleExportLedger} disabled={operations.length === 0}>
              Export ledger
            </button>
            <button type="button" onClick={() => setOperations([])} disabled={operations.length === 0}>
              Clear
            </button>
          </div>
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
            Ask AI to compile layout
          </button>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <span>API</span>
            <h2>Model</h2>
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

      <PreviewStage
        code={code}
        inspectMode={inspectMode}
        onCodeChange={handleCodeChange}
        onOperation={handleOperation}
        onSelectElement={setSelectedElement}
      />

      <aside className="code-panel">
        <header>
          <h2>Source</h2>
          <button type="button" disabled={isCodeExportLocked} onClick={() => navigator.clipboard.writeText(code)}>
            {isCodeExportLocked ? 'Syncing' : 'Copy'}
          </button>
        </header>
        <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} />
        <div className="stream-box">
          <strong>Model stream</strong>
          <p>{streamText || 'The latest model response will appear here while streaming.'}</p>
        </div>
      </aside>
    </main>
  );
}

export default App;

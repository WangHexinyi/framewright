import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureOperation, SelectedElement } from '../types';
import { isGestureOperation, isSelectedElement } from '../services/validation';

interface PreviewStageProps {
  code: string;
  inspectMode: boolean;
  onCodeChange: (code: string) => void;
  onOperation: (operation: GestureOperation) => void;
  onSelectElement: (element: SelectedElement | null) => void;
}

function buildInspectorScript(): string {
  return `<script id="__framewright_inspector__">
(function() {
  var inspectMode = false;
  var selectedEl = null;
  var hoveredEl = null;
  var handle = null;
  var idCounter = 1;
  var activeFrame = 0;
  var pendingApply = null;
  var selectColor = 'rgba(191, 91, 58, 0.95)';
  var hoverColor = 'rgba(191, 91, 58, 0.55)';

  function ensureInteractionStyle() {
    if (document.getElementById('__framewright_interaction_style__')) return;
    var style = document.createElement('style');
    style.id = '__framewright_interaction_style__';
    style.textContent = [
      'html.__fw_interacting, html.__fw_interacting * {',
      '  transition: none !important;',
      '  animation-play-state: paused !important;',
      '  scroll-behavior: auto !important;',
      '}',
      'html.__fw_interacting { cursor: grabbing !important; user-select: none !important; }',
      '.__fw_resize_handle { touch-action: none; }'
    ].join('\\n');
    document.head.appendChild(style);
  }

  function setInteractionActive(active) {
    ensureInteractionStyle();
    document.documentElement.classList.toggle('__fw_interacting', active);
  }

  function scheduleApply(apply) {
    pendingApply = apply;
    if (activeFrame) return;
    activeFrame = requestAnimationFrame(function() {
      activeFrame = 0;
      var fn = pendingApply;
      pendingApply = null;
      if (fn) fn();
    });
  }

  function uid() {
    return 'fw-' + Date.now().toString(36) + '-' + (idCounter++);
  }

  function ensureIds() {
    Array.prototype.forEach.call(document.body.querySelectorAll('*'), function(el) {
      if (el.id === '__framewright_inspector__') return;
      if (el.classList && el.classList.contains('__fw_resize_handle')) return;
      if (!el.dataset.frameId) el.dataset.frameId = uid();
    });
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height)
    };
  }

  function parentContext(el) {
    if (!el || !el.parentElement) return null;
    var p = el.parentElement;
    var cs = getComputedStyle(p);
    return {
      tagName: p.tagName.toLowerCase(),
      display: cs.display,
      position: cs.position,
      flexDirection: cs.flexDirection,
      gridTemplateColumns: cs.gridTemplateColumns,
      gap: cs.gap
    };
  }

  function selectorPath(el) {
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var part = cur.tagName.toLowerCase();
      if (cur.id && cur.id !== '__framewright_inspector__') {
        part += '#' + cur.id;
        parts.unshift(part);
        break;
      }
      if (cur.dataset && cur.dataset.frameId) {
        part += '[data-frame-id="' + cur.dataset.frameId + '"]';
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function cleanHtml() {
    var clone = document.documentElement.cloneNode(true);
    var injected = clone.querySelector('#__framewright_inspector__');
    if (injected) injected.remove();
    var interactionStyle = clone.querySelector('#__framewright_interaction_style__');
    if (interactionStyle) interactionStyle.remove();
    Array.prototype.forEach.call(clone.querySelectorAll('.__fw_resize_handle'), function(n) { n.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('[contenteditable]'), function(n) { n.removeAttribute('contenteditable'); });
    return '<!DOCTYPE html>\\n' + clone.outerHTML;
  }

  function post(type, payload) {
    window.parent.postMessage(Object.assign({ source: 'framewright-inspector', type: type }, payload || {}), '*');
  }

  function operation(type, el, before, after, extra) {
    post('operation', Object.assign({
      operation: {
        id: uid(),
        type: type,
        frameId: el.dataset.frameId,
        tagName: el.tagName.toLowerCase(),
        selectorPath: selectorPath(el),
        before: before,
        after: after,
        inlineStyleAfter: el.getAttribute('style') || '',
        context: {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          parent: parentContext(el)
        },
        createdAt: Date.now()
      }
    }, extra || {}));
    post('code-updated', { html: cleanHtml() });
  }

  function clearHover() {
    if (hoveredEl && hoveredEl !== selectedEl) {
      hoveredEl.style.outline = '';
      hoveredEl.style.outlineOffset = '';
    }
    hoveredEl = null;
  }

  function placeHandle() {
    if (!selectedEl || !handle) return;
    var r = selectedEl.getBoundingClientRect();
    handle.style.left = (r.right + window.scrollX - 9) + 'px';
    handle.style.top = (r.bottom + window.scrollY - 9) + 'px';
  }

  function removeHandle() {
    if (handle && handle.parentNode) handle.parentNode.removeChild(handle);
    handle = null;
  }

  function select(el) {
    deselect(false);
    selectedEl = el;
    selectedEl.style.outline = '2px solid ' + selectColor;
    selectedEl.style.outlineOffset = '2px';
    handle = document.createElement('div');
    handle.className = '__fw_resize_handle';
    Object.assign(handle.style, {
      position: 'absolute',
      width: '18px',
      height: '18px',
      borderRadius: '6px',
      background: selectColor,
      border: '2px solid white',
      cursor: 'nwse-resize',
      zIndex: '2147483647',
      boxShadow: '0 2px 8px rgba(0,0,0,.28)'
    });
    document.body.appendChild(handle);
    placeHandle();
    bindResize(handle, selectedEl);
    post('selected', {
      element: {
        frameId: el.dataset.frameId,
        tagName: el.tagName.toLowerCase(),
        selectorPath: selectorPath(el),
        textContent: (el.textContent || '').trim().slice(0, 160),
        outerHTML: el.outerHTML.slice(0, 800)
      }
    });
  }

  function deselect(notify) {
    if (selectedEl) {
      selectedEl.style.outline = '';
      selectedEl.style.outlineOffset = '';
    }
    selectedEl = null;
    removeHandle();
    if (notify !== false) post('selected', { element: null });
  }

  function bindResize(node, el) {
    node.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      setInteractionActive(true);
      var before = rectOf(el);
      var startX = e.clientX;
      var startY = e.clientY;
      var startW = before.width;
      var startH = before.height;

      function move(ev) {
        var nextWidth = Math.max(32, startW + ev.clientX - startX);
        var nextHeight = Math.max(24, startH + ev.clientY - startY);
        scheduleApply(function() {
          el.style.width = Math.round(nextWidth) + 'px';
          el.style.height = Math.round(nextHeight) + 'px';
          placeHandle();
        });
      }

      function up() {
        setInteractionActive(false);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        operation('resize', el, before, rectOf(el));
      }

      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  function startMove(e, el) {
    e.preventDefault();
    setInteractionActive(true);
    var before = rectOf(el);
    var startX = e.clientX;
    var startY = e.clientY;
    var transform = getComputedStyle(el).transform;
    var baseX = 0;
    var baseY = 0;
    if (transform && transform !== 'none') {
      try {
        var m = new DOMMatrix(transform);
        baseX = m.m41;
        baseY = m.m42;
      } catch (_) {}
    }

    function move(ev) {
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      var nextX = Math.round(baseX + dx);
      var nextY = Math.round(baseY + dy);
      scheduleApply(function() {
        el.style.transform = 'translate3d(' + nextX + 'px, ' + nextY + 'px, 0)';
        el.style.willChange = 'transform';
        placeHandle();
      });
    }

    function up() {
      setInteractionActive(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      el.style.willChange = '';
      operation('move', el, before, rectOf(el));
    }

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  function beginTextEdit(e, el) {
    var beforeText = el.textContent || '';
    var before = rectOf(el);
    el.contentEditable = 'true';
    el.focus();
    el.style.outline = '2px solid ' + selectColor;

    function finish() {
      el.contentEditable = 'false';
      el.removeEventListener('blur', finish);
      el.removeEventListener('keydown', keydown);
      operation('editText', el, before, rectOf(el), {
        operation: Object.assign({}, {
          id: uid(),
          type: 'editText',
          frameId: el.dataset.frameId,
          tagName: el.tagName.toLowerCase(),
          selectorPath: selectorPath(el),
          before: before,
          after: rectOf(el),
          textBefore: beforeText,
          textAfter: el.textContent || '',
          inlineStyleAfter: el.getAttribute('style') || '',
          context: {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            parent: parentContext(el)
          },
          createdAt: Date.now()
        })
      });
    }

    function keydown(ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        el.blur();
      }
      if (ev.key === 'Escape') el.blur();
    }

    el.addEventListener('blur', finish);
    el.addEventListener('keydown', keydown);
  }

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.source !== 'framewright-parent') return;
    if (e.data.type === 'inspect-mode') {
      inspectMode = !!e.data.enabled;
      document.body.style.cursor = inspectMode ? 'crosshair' : '';
      clearHover();
      if (!inspectMode) deselect();
    }
  });

  document.addEventListener('mouseover', function(e) {
    if (!inspectMode) return;
    var target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.classList && target.classList.contains('__fw_resize_handle')) return;
    clearHover();
    hoveredEl = target;
    if (hoveredEl !== selectedEl) {
      hoveredEl.style.outline = '2px dashed ' + hoverColor;
      hoveredEl.style.outlineOffset = '2px';
    }
  }, true);

  document.addEventListener('mouseout', function() {
    if (inspectMode) clearHover();
  }, true);

  document.addEventListener('click', function(e) {
    if (!inspectMode) return;
    var target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.classList && target.classList.contains('__fw_resize_handle')) return;
    e.preventDefault();
    e.stopPropagation();
    ensureIds();
    select(target);
  }, true);

  document.addEventListener('mousedown', function(e) {
    if (!inspectMode || !selectedEl) return;
    var target = e.target;
    if (target.classList && target.classList.contains('__fw_resize_handle')) return;
    if (selectedEl.contains(target)) startMove(e, selectedEl);
  }, true);

  document.addEventListener('dblclick', function(e) {
    var target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.classList && target.classList.contains('__fw_resize_handle')) return;
    e.preventDefault();
    e.stopPropagation();
    ensureIds();
    beginTextEdit(e, target);
  }, true);

  ensureIds();
  post('code-updated', { html: cleanHtml() });
})();
</script>`;
}

function injectInspector(html: string): string {
  const script = buildInspectorScript();
  if (!html.trim()) return '';
  if (html.includes('__framewright_inspector__')) return html;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
  return `${html}\n${script}`;
}

export function PreviewStage({
  code,
  inspectMode,
  onCodeChange,
  onOperation,
  onSelectElement,
}: PreviewStageProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const enhancedCode = useMemo(() => injectInspector(code), [code]);

  const postInspectMode = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'framewright-parent', type: 'inspect-mode', enabled: inspectMode },
      '*',
    );
  }, [inspectMode]);

  useEffect(() => {
    postInspectMode();
  }, [postInspectMode, enhancedCode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || event.data.source !== 'framewright-inspector') return;

      if (event.data.type === 'code-updated' && typeof event.data.html === 'string') {
        onCodeChange(event.data.html);
      }

      if (event.data.type === 'operation' && event.data.operation) {
        if (isGestureOperation(event.data.operation)) {
          onOperation(event.data.operation);
        }
      }

      if (event.data.type === 'selected') {
        const element = event.data.element ?? null;
        if (isSelectedElement(element)) {
          onSelectElement(element);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCodeChange, onOperation, onSelectElement]);

  const width = device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '390px';

  return (
    <section className="preview-stage">
      <div className="stage-toolbar">
        <div>
          <strong>Live canvas</strong>
          <span>Sandboxed iframe, no same-origin access</span>
        </div>
        <div className="segmented">
          {(['desktop', 'tablet', 'mobile'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={device === item ? 'active' : ''}
              onClick={() => setDevice(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="stage-shell">
        {code ? (
          <div className="device-frame" style={{ width }}>
            <iframe
              ref={iframeRef}
              title="Framewright preview"
              srcDoc={enhancedCode}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              referrerPolicy="no-referrer"
              onLoad={postInspectMode}
            />
          </div>
        ) : (
          <div className="empty-canvas">
            <h2>Generate an interface to start.</h2>
            <p>Then turn on Inspect and reshape the result directly.</p>
          </div>
        )}
      </div>
    </section>
  );
}

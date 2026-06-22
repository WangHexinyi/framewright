import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureOperation, SelectedElement } from '../types';
import { isGestureOperation, isSelectedElement } from '../services/validation';

interface PreviewStageProps {
  code: string;
  inspectMode: boolean;
  deferPreviewSync?: boolean;
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
  var moveable = null;
  var idCounter = 1;
  var activeFrame = 0;
  var pendingApply = null;
  var remoteApplyInProgress = false;
  var idiomorphPromise = null;
  var moveablePromise = null;
  var gestureStartRect = null;
  var selectColor = 'rgba(191, 91, 58, 0.95)';
  var hoverColor = 'rgba(191, 91, 58, 0.55)';
  var tempIdPrefix = '__fw_key_';

  function loadIdiomorph() {
    if (window.Idiomorph && typeof window.Idiomorph.morph === 'function') {
      return Promise.resolve(window.Idiomorph);
    }
    if (idiomorphPromise) return idiomorphPromise;
    idiomorphPromise = new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/idiomorph@0.7.4/dist/idiomorph.min.js';
      script.async = true;
      script.onload = function() { resolve(window.Idiomorph); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return idiomorphPromise;
  }

  function loadMoveable() {
    if (window.Moveable) return Promise.resolve(window.Moveable);
    if (moveablePromise) return moveablePromise;
    moveablePromise = new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://daybrush.com/moveable/release/latest/dist/moveable.min.js';
      script.async = true;
      script.onload = function() { resolve(window.Moveable); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return moveablePromise;
  }

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

  function slugPart(value) {
    return String(value || 'node')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node';
  }

  function componentPath(el) {
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var parent = cur.parentElement;
      var index = parent ? Array.prototype.indexOf.call(parent.children, cur) + 1 : 1;
      parts.unshift(cur.getAttribute('data-block-id') || slugPart(cur.id || cur.tagName.toLowerCase() + index));
      cur = parent;
    }
    parts.unshift('body');
    return parts;
  }

  function blockIdFor(el) {
    var existing = el.getAttribute('data-block-id');
    if (existing) return existing;
    return 'block_' + componentPath(el).map(slugPart).join('_');
  }

  function ensureIds() {
    Array.prototype.forEach.call(document.body.querySelectorAll('*'), function(el) {
      if (el.id === '__framewright_inspector__') return;
      if (el.classList && el.classList.contains('__fw_resize_handle')) return;
      if (!el.dataset.blockId) el.dataset.blockId = blockIdFor(el);
      if (!el.dataset.frameId) el.dataset.frameId = uid();
    });
  }

  function ensureIdsIn(root) {
    Array.prototype.forEach.call(root.querySelectorAll('*'), function(el) {
      if (!el.dataset.blockId) el.dataset.blockId = blockIdFor(el);
      if (!el.dataset.frameId) el.dataset.frameId = uid();
    });
  }

  function keyToTempId(key) {
    return tempIdPrefix + String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function promoteFrameIds(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-frame-id]'), function(el) {
      if (el.id) return;
      el.id = keyToTempId(el.dataset.frameId);
      el.setAttribute('data-fw-temp-id', 'true');
    });
  }

  function stripTempIds(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-fw-temp-id="true"]'), function(el) {
      if (el.id && el.id.indexOf(tempIdPrefix) === 0) el.removeAttribute('id');
      el.removeAttribute('data-fw-temp-id');
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

  function layoutHint(el, type, before, after) {
    if (!el || !el.parentElement || !before || !after) return null;
    var siblings = Array.prototype.filter.call(el.parentElement.children, function(child) {
      return child !== el && child.nodeType === Node.ELEMENT_NODE;
    });
    var alignedRows = siblings.filter(function(child) {
      var r = child.getBoundingClientRect();
      return Math.abs(Math.round(r.y) - after.y) <= 12 || Math.abs(Math.round(r.bottom) - Math.round(after.y + after.height)) <= 12;
    }).length;
    var alignedColumns = siblings.filter(function(child) {
      var r = child.getBoundingClientRect();
      return Math.abs(Math.round(r.x) - after.x) <= 12 || Math.abs(Math.round(r.right) - Math.round(after.x + after.width)) <= 12;
    }).length;

    if (alignedRows > 0) {
      return {
        intent: 'horizontal row',
        reason: type + ' ended aligned with sibling vertical bounds; prefer flex row or grid columns over absolute offsets.',
        siblingCount: siblings.length + 1
      };
    }
    if (alignedColumns > 0) {
      return {
        intent: 'vertical stack',
        reason: type + ' ended aligned with sibling horizontal bounds; prefer flex column, grid rows, gap, margin, or padding.',
        siblingCount: siblings.length + 1
      };
    }
    return {
      intent: type === 'resize' ? 'responsive emphasis size' : 'spacing adjustment',
      reason: 'No strong sibling alignment detected; compile the delta into container spacing, alignment, or proportional sizing.',
      siblingCount: siblings.length + 1
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
    Array.prototype.forEach.call(clone.querySelectorAll('.moveable-control-box'), function(n) { n.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('[data-fw-temp-id]'), function(n) {
      if (n.id && n.id.indexOf(tempIdPrefix) === 0) n.removeAttribute('id');
      n.removeAttribute('data-fw-temp-id');
    });
    Array.prototype.forEach.call(clone.querySelectorAll('[contenteditable]'), function(n) { n.removeAttribute('contenteditable'); });
    return '<!DOCTYPE html>\\n' + clone.outerHTML;
  }

  function applyRemoteHtml(html) {
    if (!html || typeof html !== 'string') return;
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    if (!doc.body) return;

    remoteApplyInProgress = true;
    deselect(false);
    clearHover();
    ensureIds();
    ensureIdsIn(doc.body);
    promoteFrameIds(document.body);
    promoteFrameIds(doc.body);

    loadIdiomorph().then(function(Idiomorph) {
      if (doc.head) {
        Idiomorph.morph(document.head, doc.head, {
          morphStyle: 'innerHTML',
          ignoreActiveValue: true,
          restoreFocus: true,
          head: { style: 'merge' }
        });
      }
      Idiomorph.morph(document.body, doc.body, {
        morphStyle: 'innerHTML',
        ignoreActiveValue: true,
        restoreFocus: true
      });
    }).catch(function() {
      document.head.innerHTML = doc.head ? doc.head.innerHTML : document.head.innerHTML;
      document.body.innerHTML = doc.body.innerHTML;
    }).finally(function() {
      stripTempIds(document);
      ensureInteractionStyle();
      ensureIds();
      remoteApplyInProgress = false;
      post('code-updated', { html: cleanHtml() });
    });
  }

  function post(type, payload) {
    window.parent.postMessage(Object.assign({ source: 'framewright-inspector', type: type }, payload || {}), '*');
  }

  function operation(type, el, before, after, extra) {
    post('operation', Object.assign({
        operation: {
          id: uid(),
          type: type,
          targetKey: el.dataset.frameId,
          blockId: el.dataset.blockId,
          componentId: el.dataset.blockId,
          componentPath: componentPath(el),
          version: Date.now(),
          frameId: el.dataset.frameId,
          tagName: el.tagName.toLowerCase(),
        selectorPath: selectorPath(el),
        before: before,
        after: after,
        inlineStyleAfter: el.getAttribute('style') || '',
        context: {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          parent: parentContext(el),
          layoutHint: layoutHint(el, type, before, after)
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

  function isEditorChrome(el) {
    return !!(el && el.classList && (
      el.classList.contains('__fw_resize_handle') ||
      el.classList.contains('moveable-control') ||
      el.classList.contains('moveable-control-box') ||
      el.classList.contains('moveable-line') ||
      el.classList.contains('moveable-area')
    ));
  }

  function deepestElementAtPoint(x, y) {
    var stack = Array.prototype.filter.call(document.elementsFromPoint(x, y), function(el) {
      return el !== document.body &&
        el !== document.documentElement &&
        !isEditorChrome(el) &&
        el.id !== '__framewright_inspector__' &&
        !(el.closest && el.closest('.moveable-control-box'));
    });
    return stack[0] || null;
  }

  function selectableFromEvent(e) {
    var direct = e.target;
    if (direct && direct.classList && (
      direct.classList.contains('__fw_resize_handle') ||
      direct.classList.contains('moveable-control') ||
      direct.classList.contains('moveable-line')
    )) return null;
    var hit = deepestElementAtPoint(e.clientX, e.clientY);
    if (!hit) return null;

    if (e.altKey) return hit;

    var broadTags = ['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'ASIDE'];
    if (broadTags.indexOf(hit.tagName) < 0 || hit.children.length === 0) return hit;

    var childStack = Array.prototype.filter.call(document.elementsFromPoint(e.clientX, e.clientY), function(el) {
      return el !== hit &&
        hit.contains(el) &&
        !isEditorChrome(el) &&
        !(el.closest && el.closest('.moveable-control-box'));
    });
    var preferred = childStack.find(function(el) {
      return ['A', 'BUTTON', 'IMG', 'SVG', 'INPUT', 'TEXTAREA', 'SELECT', 'H1', 'H2', 'H3', 'H4', 'P', 'SPAN', 'SMALL', 'STRONG', 'EM', 'LI'].indexOf(el.tagName) >= 0;
    });
    return preferred || childStack[0] || hit;
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

  function destroyMoveable() {
    if (moveable && typeof moveable.destroy === 'function') moveable.destroy();
    moveable = null;
  }

  function elementGuidelines(target) {
    return Array.prototype.filter.call(document.body.querySelectorAll('*'), function(el) {
      return el !== target &&
        el.id !== '__framewright_inspector__' &&
        !(el.classList && (el.classList.contains('__fw_resize_handle') || el.classList.contains('moveable-control-box')));
    }).slice(0, 120);
  }

  function initMoveable(target) {
    loadMoveable().then(function(Moveable) {
      destroyMoveable();
      removeHandle();
      moveable = new Moveable(document.body, {
        target: target,
        draggable: true,
        resizable: true,
        rotatable: true,
        snappable: true,
        snapGap: true,
        snapElement: true,
        elementGuidelines: elementGuidelines(target),
        origin: false,
        keepRatio: false,
        throttleDrag: 1,
        throttleResize: 1,
        throttleRotate: 1,
        edge: false
      });

      moveable
        .on('dragStart', function() {
          gestureStartRect = rectOf(target);
          setInteractionActive(true);
        })
        .on('drag', function(e) {
          e.target.style.transform = e.transform;
        })
        .on('dragEnd', function() {
          setInteractionActive(false);
          operation('move', target, gestureStartRect, rectOf(target));
          gestureStartRect = null;
        })
        .on('resizeStart', function(e) {
          gestureStartRect = rectOf(target);
          setInteractionActive(true);
          if (e.dragStart) e.dragStart.set(getTranslate(target));
        })
        .on('resize', function(e) {
          e.target.style.width = Math.round(e.width) + 'px';
          e.target.style.height = Math.round(e.height) + 'px';
          if (e.drag) e.target.style.transform = e.drag.transform;
        })
        .on('resizeEnd', function() {
          setInteractionActive(false);
          operation('resize', target, gestureStartRect, rectOf(target));
          gestureStartRect = null;
        })
        .on('rotateStart', function() {
          gestureStartRect = rectOf(target);
          setInteractionActive(true);
        })
        .on('rotate', function(e) {
          e.target.style.transform = e.drag.transform;
        })
        .on('rotateEnd', function() {
          setInteractionActive(false);
          operation('move', target, gestureStartRect, rectOf(target));
          gestureStartRect = null;
        });
    }).catch(function() {
      if (!handle && selectedEl === target) {
        placeHandle();
      }
    });
  }

  function getTranslate(el) {
    var transform = getComputedStyle(el).transform;
    if (!transform || transform === 'none') return [0, 0];
    try {
      var matrix = new DOMMatrix(transform);
      return [matrix.m41, matrix.m42];
    } catch (_) {
      return [0, 0];
    }
  }

  function select(el) {
    deselect(false);
    selectedEl = el;
    destroyMoveable();
    selectedEl.style.outline = '2px solid ' + selectColor;
    selectedEl.style.outlineOffset = '2px';
    post('selected', {
      element: {
        frameId: el.dataset.frameId,
        blockId: el.dataset.blockId,
        componentId: el.dataset.blockId,
        componentPath: componentPath(el),
        tagName: el.tagName.toLowerCase(),
        selectorPath: selectorPath(el),
        textContent: (el.textContent || '').trim().slice(0, 160),
        outerHTML: el.outerHTML.slice(0, 800)
      }
    });
    initMoveable(el);
  }

  function deselect(notify) {
    if (selectedEl) {
      selectedEl.style.outline = '';
      selectedEl.style.outlineOffset = '';
    }
    selectedEl = null;
    removeHandle();
    destroyMoveable();
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
          targetKey: el.dataset.frameId,
          blockId: el.dataset.blockId,
          componentId: el.dataset.blockId,
          componentPath: componentPath(el),
          version: Date.now(),
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
            parent: parentContext(el),
            layoutHint: layoutHint(el, 'editText', before, rectOf(el))
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
    if (e.data.type === 'render-code') {
      applyRemoteHtml(e.data.html);
    }
  });

  document.addEventListener('mouseover', function(e) {
    if (!inspectMode) return;
    var target = selectableFromEvent(e);
    if (!target || target === document.body || target === document.documentElement) return;
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
    var target = selectableFromEvent(e);
    if (!target || target === document.body || target === document.documentElement) return;
    e.preventDefault();
    e.stopPropagation();
    ensureIds();
    select(target);
  }, true);

  document.addEventListener('mousedown', function(e) {
    if (!inspectMode || !selectedEl) return;
    var target = selectableFromEvent(e);
    if (!target) return;
    if (moveable) return;
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
  if (!remoteApplyInProgress) post('code-updated', { html: cleanHtml() });
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
  deferPreviewSync = false,
  onCodeChange,
  onOperation,
  onSelectElement,
}: PreviewStageProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [srcDoc, setSrcDoc] = useState(() => injectInspector(code));
  const iframeReadyRef = useRef(false);
  const inspectorUpdateRef = useRef(false);

  useEffect(() => {
    if (inspectorUpdateRef.current) {
      inspectorUpdateRef.current = false;
      return;
    }
    if (deferPreviewSync) return;

    if (!code.trim()) {
      iframeReadyRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSrcDoc('');
      return;
    }

    if (!iframeReadyRef.current || !iframeRef.current?.contentWindow) {
      setSrcDoc(injectInspector(code));
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      { source: 'framewright-parent', type: 'render-code', html: code },
      '*',
    );
  }, [code, deferPreviewSync]);

  const postInspectMode = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'framewright-parent', type: 'inspect-mode', enabled: inspectMode },
      '*',
    );
  }, [inspectMode]);

  useEffect(() => {
    postInspectMode();
  }, [postInspectMode, srcDoc]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || event.data.source !== 'framewright-inspector') return;

      if (event.data.type === 'code-updated' && typeof event.data.html === 'string') {
        inspectorUpdateRef.current = true;
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
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              referrerPolicy="no-referrer"
              onLoad={() => {
                iframeReadyRef.current = true;
                postInspectMode();
              }}
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

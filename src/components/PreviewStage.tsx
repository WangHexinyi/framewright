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
  var selectionBox = null;
  var measureLayer = null;
  var hitLayer = null;
  var idCounter = 1;
  var activeFrame = 0;
  var pendingApply = null;
  var remoteApplyInProgress = false;
  var gestureStartRect = null;
  var selectColor = 'rgba(191, 91, 58, 0.95)';
  var hoverColor = 'rgba(191, 91, 58, 0.55)';
  var tempIdPrefix = '__fw_key_';
  var snapThreshold = 6;

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
      'html.__fw_inspect_mode *, html.__fw_interacting * {',
      '  transition: none !important;',
      '  animation-play-state: paused !important;',
      '}',
      'html.__fw_interacting { cursor: grabbing !important; user-select: none !important; }',
      '.__fw_selection_box {',
      '  all: initial;',
      '  position: fixed;',
      '  z-index: 2147483646;',
      '  display: block;',
      '  border: 2px solid var(--fw-select-color, rgba(67, 154, 255, 0.98));',
      '  box-sizing: border-box;',
      '  pointer-events: none;',
      '  touch-action: none;',
      '  background: transparent;',
      '  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '}',
      '.__fw_selection_handle {',
      '  all: initial;',
      '  position: absolute;',
      '  display: block;',
      '  width: 10px;',
      '  height: 10px;',
      '  border-radius: 999px;',
      '  border: 2px solid var(--fw-select-color, rgba(67, 154, 255, 0.98));',
      '  background: #fff;',
      '  box-sizing: border-box;',
      '  pointer-events: auto;',
      '  touch-action: none;',
      '}',
      '.__fw_selection_badge {',
      '  all: initial;',
      '  position: fixed;',
      '  display: block;',
      '  max-width: 180px;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '  padding: 4px 7px;',
      '  border-radius: 7px;',
      '  background: var(--fw-select-color, rgba(67, 154, 255, 0.98));',
      '  color: #fff;',
      '  z-index: 2147483647;',
      '  font: 700 11px/1.2 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);',
      '  pointer-events: none;',
      '}',
      '.__fw_selection_handle[data-dir="nw"] { left: -6px; top: -6px; cursor: nwse-resize; }',
      '.__fw_selection_handle[data-dir="n"] { left: 50%; top: -6px; transform: translateX(-50%); cursor: ns-resize; }',
      '.__fw_selection_handle[data-dir="ne"] { right: -6px; top: -6px; cursor: nesw-resize; }',
      '.__fw_selection_handle[data-dir="e"] { right: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }',
      '.__fw_selection_handle[data-dir="se"] { right: -6px; bottom: -6px; cursor: nwse-resize; }',
      '.__fw_selection_handle[data-dir="s"] { left: 50%; bottom: -6px; transform: translateX(-50%); cursor: ns-resize; }',
      '.__fw_selection_handle[data-dir="sw"] { left: -6px; bottom: -6px; cursor: nesw-resize; }',
      '.__fw_selection_handle[data-dir="w"] { left: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }',
      '.__fw_inspect_hit_layer {',
      '  all: initial;',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 2147483645;',
      '  display: block;',
      '  cursor: crosshair;',
      '  background: transparent;',
      '  pointer-events: auto;',
      '  touch-action: none;',
      '}',
      '.__fw_measure_layer {',
      '  all: initial;',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 2147483644;',
      '  pointer-events: none;',
      '  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '}',
      '.__fw_snap_line {',
      '  all: initial;',
      '  position: fixed;',
      '  display: block;',
      '  background: rgba(39, 126, 255, 0.72);',
      '  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.65);',
      '}',
      '.__fw_distance_line {',
      '  all: initial;',
      '  position: fixed;',
      '  display: block;',
      '  background: rgba(245, 132, 53, 0.72);',
      '  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.72);',
      '}',
      '.__fw_distance_line[data-axis="x"] { height: 1px; }',
      '.__fw_distance_line[data-axis="y"] { width: 1px; }',
      '.__fw_snap_line[data-axis="x"] { top: 0; bottom: 0; width: 1px; }',
      '.__fw_snap_line[data-axis="y"] { left: 0; right: 0; height: 1px; }',
      '.__fw_measure_badge {',
      '  all: initial;',
      '  position: fixed;',
      '  display: block;',
      '  padding: 4px 6px;',
      '  border-radius: 6px;',
      '  background: rgba(31, 26, 22, 0.88);',
      '  color: #fff;',
      '  font: 700 11px/1.2 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.22);',
      '  white-space: nowrap;',
      '}'
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
      if (el.classList && (
        el.classList.contains('__fw_selection_box') ||
        el.classList.contains('__fw_selection_handle') ||
        el.classList.contains('__fw_selection_badge') ||
        el.classList.contains('__fw_measure_layer') ||
        el.classList.contains('__fw_snap_line') ||
        el.classList.contains('__fw_distance_line') ||
        el.classList.contains('__fw_measure_badge')
      )) return;
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

  function elementKind(el) {
    var tag = el.tagName;
    if (['BUTTON', 'A'].indexOf(tag) >= 0 || el.getAttribute('role') === 'button') return 'button';
    if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(tag) >= 0) return 'input';
    if (['IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'SVG'].indexOf(tag) >= 0) return 'media';
    if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'SMALL', 'STRONG', 'EM', 'LI', 'LABEL'].indexOf(tag) >= 0) return 'text';
    var text = (el.textContent || '').trim();
    var hasElementChildren = Array.prototype.some.call(el.children || [], function(child) {
      return child.nodeType === Node.ELEMENT_NODE;
    });
    var cs = getComputedStyle(el);
    var hasVisualFill = (cs.backgroundImage && cs.backgroundImage !== 'none') ||
      (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') ||
      (cs.borderImageSource && cs.borderImageSource !== 'none');
    if (!hasElementChildren && text.length > 0) return 'text';
    if (!text && hasVisualFill) return 'graphic';
    return 'container';
  }

  function selectionColorFor(kind) {
    if (kind === 'text') return 'rgba(39, 126, 255, 0.98)';
    if (kind === 'button' || kind === 'input') return 'rgba(22, 163, 74, 0.98)';
    if (kind === 'graphic' || kind === 'media') return 'rgba(168, 85, 247, 0.98)';
    return 'rgba(245, 132, 53, 0.98)';
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
    Array.prototype.forEach.call(clone.querySelectorAll('style[data-styled-id][data-styled-count]'), function(n) { n.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('.__fw_selection_box,.__fw_selection_handle,.__fw_selection_badge,.__fw_resize_handle,.__fw_inspect_hit_layer,.__fw_measure_layer,.__fw_snap_line,.__fw_distance_line,.__fw_measure_badge'), function(n) { n.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('[data-fw-temp-id]'), function(n) {
      if (n.id && n.id.indexOf(tempIdPrefix) === 0) n.removeAttribute('id');
      n.removeAttribute('data-fw-temp-id');
    });
    Array.prototype.forEach.call(clone.querySelectorAll('[style]'), function(n) {
      n.style.removeProperty('outline');
      n.style.removeProperty('outline-offset');
      n.style.removeProperty('will-change');
      if (!n.getAttribute('style').trim()) n.removeAttribute('style');
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

    document.head.innerHTML = doc.head ? doc.head.innerHTML : document.head.innerHTML;
    document.body.innerHTML = doc.body.innerHTML;
    stripTempIds(document);
    ensureInteractionStyle();
    ensureIds();
    if (inspectMode) ensureInspectHitLayer();
    remoteApplyInProgress = false;
    post('code-updated', { html: cleanHtml() });
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
      el.classList.contains('__fw_selection_box') ||
      el.classList.contains('__fw_selection_handle') ||
      el.classList.contains('__fw_selection_badge') ||
      el.classList.contains('__fw_measure_layer') ||
      el.classList.contains('__fw_snap_line') ||
      el.classList.contains('__fw_distance_line') ||
      el.classList.contains('__fw_measure_badge')
    ));
  }

  function deepestElementAtPoint(x, y) {
    var stack = Array.prototype.filter.call(document.elementsFromPoint(x, y), function(el) {
      return el !== document.body &&
        el !== document.documentElement &&
        !isEditorChrome(el) &&
        el.id !== '__framewright_inspector__' &&
        !(el.classList && el.classList.contains('__fw_inspect_hit_layer'));
    });
    return stack[0] || null;
  }

  function selectableFromEvent(e) {
    var direct = e.target;
    if (direct && direct.classList && (
      direct.classList.contains('__fw_resize_handle') ||
      direct.classList.contains('__fw_selection_handle') ||
      direct.classList.contains('__fw_measure_layer')
    )) return null;
    var hit = deepestElementAtPoint(e.clientX, e.clientY);
    if (!hit) return null;

    if (e.altKey) return hit;

    var broadTags = ['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'ASIDE'];
    if (broadTags.indexOf(hit.tagName) < 0 || hit.children.length === 0) return hit;

    var childStack = Array.prototype.filter.call(document.elementsFromPoint(e.clientX, e.clientY), function(el) {
      return el !== hit &&
        hit.contains(el) &&
        !isEditorChrome(el);
    });
    var preferred = childStack.find(function(el) {
      return ['A', 'BUTTON', 'IMG', 'SVG', 'INPUT', 'TEXTAREA', 'SELECT', 'H1', 'H2', 'H3', 'H4', 'P', 'SPAN', 'SMALL', 'STRONG', 'EM', 'LI'].indexOf(el.tagName) >= 0;
    });
    return preferred || childStack[0] || hit;
  }

  function placeSelectionBox() {
    if (!selectedEl || !selectionBox) return;
    var r = selectedEl.getBoundingClientRect();
    selectionBox.style.left = r.left + 'px';
    selectionBox.style.top = r.top + 'px';
    selectionBox.style.width = Math.max(0, r.width) + 'px';
    selectionBox.style.height = Math.max(0, r.height) + 'px';
    selectionBox.style.borderRadius = getComputedStyle(selectedEl).borderRadius || '0px';
    selectionBox.style.setProperty('--fw-select-color', selectionColorFor(elementKind(selectedEl)));
    var badge = selectionBox.querySelector('.__fw_selection_badge');
    if (badge) {
      badge.style.left = Math.round(Math.max(8, r.left)) + 'px';
      badge.style.top = Math.round(r.top > 34 ? r.top - 32 : r.bottom + 10) + 'px';
    }
  }

  function removeSelectionBox() {
    if (selectionBox && selectionBox.parentNode) selectionBox.parentNode.removeChild(selectionBox);
    selectionBox = null;
  }

  function removeMeasureLayer() {
    if (measureLayer && measureLayer.parentNode) measureLayer.parentNode.removeChild(measureLayer);
    measureLayer = null;
  }

  function ensureMeasureLayer() {
    ensureInteractionStyle();
    if (!measureLayer || !measureLayer.parentNode) {
      measureLayer = document.createElement('div');
      measureLayer.className = '__fw_measure_layer';
      measureLayer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(measureLayer);
    }
    measureLayer.innerHTML = '';
    return measureLayer;
  }

  function finiteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function roundedRect(rect) {
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height))
    };
  }

  function buildSnapGuides(target) {
    var guides = { x: [], y: [] };
    var seen = {};

    function add(axis, value) {
      if (!finiteNumber(value)) return;
      var rounded = Math.round(value);
      var key = axis + ':' + rounded;
      if (seen[key]) return;
      seen[key] = true;
      guides[axis].push(rounded);
    }

    add('x', 0);
    add('x', window.innerWidth / 2);
    add('x', window.innerWidth);
    add('y', 0);
    add('y', window.innerHeight / 2);
    add('y', window.innerHeight);

    Array.prototype.forEach.call(document.body.querySelectorAll('*'), function(el) {
      if (el === target || target.contains(el) || isEditorChrome(el)) return;
      if (el.id === '__framewright_inspector__') return;
      if (el.classList && el.classList.contains('__fw_inspect_hit_layer')) return;
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      add('x', r.left);
      add('x', r.left + r.width / 2);
      add('x', r.right);
      add('y', r.top);
      add('y', r.top + r.height / 2);
      add('y', r.bottom);
    });

    return guides;
  }

  function bestSnap(candidates, guides) {
    var best = null;
    candidates.forEach(function(candidate) {
      guides.forEach(function(guide) {
        var distance = Math.abs(candidate.value - guide);
        if (distance <= snapThreshold && (!best || distance < best.distance)) {
          best = {
            value: guide + candidate.offset,
            guide: guide,
            distance: distance
          };
        }
      });
    });
    return best;
  }

  function snapRect(rect, guides, axes) {
    var next = roundedRect(rect);
    var snaps = { x: null, y: null };

    if (axes.x) {
      var xSnap = bestSnap([
        { value: next.x, offset: 0 },
        { value: next.x + next.width / 2, offset: -next.width / 2 },
        { value: next.x + next.width, offset: -next.width }
      ], guides.x);
      if (xSnap) {
        next.x = Math.round(xSnap.value);
        snaps.x = xSnap.guide;
      }
    }

    if (axes.y) {
      var ySnap = bestSnap([
        { value: next.y, offset: 0 },
        { value: next.y + next.height / 2, offset: -next.height / 2 },
        { value: next.y + next.height, offset: -next.height }
      ], guides.y);
      if (ySnap) {
        next.y = Math.round(ySnap.value);
        snaps.y = ySnap.guide;
      }
    }

    return { rect: next, snaps: snaps };
  }

  function updateMeasure(rect, snaps) {
    var layer = ensureMeasureLayer();

    function addLine(axis, start, end, cross) {
      if (end <= start) return;
      var line = document.createElement('div');
      line.className = '__fw_distance_line';
      line.dataset.axis = axis;
      if (axis === 'x') {
        line.style.left = Math.round(start) + 'px';
        line.style.top = Math.round(cross) + 'px';
        line.style.width = Math.round(end - start) + 'px';
      } else {
        line.style.left = Math.round(cross) + 'px';
        line.style.top = Math.round(start) + 'px';
        line.style.height = Math.round(end - start) + 'px';
      }
      layer.appendChild(line);
    }

    function addBadge(text, x, y) {
      var badge = document.createElement('div');
      badge.className = '__fw_measure_badge';
      badge.textContent = text;
      badge.style.left = Math.max(8, Math.min(window.innerWidth - 170, Math.round(x))) + 'px';
      badge.style.top = Math.max(8, Math.min(window.innerHeight - 24, Math.round(y))) + 'px';
      layer.appendChild(badge);
    }

    if (snaps && snaps.x !== null) {
      var xLine = document.createElement('div');
      xLine.className = '__fw_snap_line';
      xLine.dataset.axis = 'x';
      xLine.style.left = Math.round(snaps.x) + 'px';
      layer.appendChild(xLine);
    }
    if (snaps && snaps.y !== null) {
      var yLine = document.createElement('div');
      yLine.className = '__fw_snap_line';
      yLine.dataset.axis = 'y';
      yLine.style.top = Math.round(snaps.y) + 'px';
      layer.appendChild(yLine);
    }

    var left = Math.round(rect.x);
    var top = Math.round(rect.y);
    var right = Math.round(rect.x + rect.width);
    var bottom = Math.round(rect.y + rect.height);
    var centerX = Math.round(rect.x + rect.width / 2);
    var centerY = Math.round(rect.y + rect.height / 2);
    var viewportRight = Math.round(window.innerWidth - right);
    var viewportBottom = Math.round(window.innerHeight - bottom);

    addLine('x', 0, left, centerY);
    addLine('x', right, window.innerWidth, centerY);
    addLine('y', 0, top, centerX);
    addLine('y', bottom, window.innerHeight, centerX);

    addBadge('L ' + left + 'px', Math.max(10, left / 2 - 28), centerY - 24);
    addBadge('R ' + viewportRight + 'px', right + Math.max(10, viewportRight / 2 - 28), centerY - 24);
    addBadge('T ' + top + 'px', centerX + 10, Math.max(8, top / 2 - 12));
    addBadge('B ' + viewportBottom + 'px', centerX + 10, bottom + Math.max(8, viewportBottom / 2 - 12));
    addBadge(Math.round(rect.width) + ' x ' + Math.round(rect.height), rect.x + 8, rect.y - 34);
    addBadge('C ' + centerX + ', ' + centerY, centerX + 10, centerY + 10);
  }

  function initSelectionBox(target) {
    removeSelectionBox();
    removeMeasureLayer();
    selectionBox = document.createElement('div');
    selectionBox.className = '__fw_selection_box';
    selectionBox.setAttribute('aria-hidden', 'true');
    selectionBox.addEventListener('mousedown', function(e) {
      if (!selectedEl || e.target !== selectionBox) return;
      startMove(e, selectedEl);
    });
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function(dir) {
      var node = document.createElement('div');
      node.className = '__fw_selection_handle';
      node.dataset.dir = dir;
      bindResize(node, target, dir);
      selectionBox.appendChild(node);
    });
    var badge = document.createElement('div');
    badge.className = '__fw_selection_badge';
    badge.textContent = elementKind(target) + ' <' + target.tagName.toLowerCase() + '>';
    selectionBox.appendChild(badge);
    document.body.appendChild(selectionBox);
    placeSelectionBox();
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
    selectedEl.style.outline = '2px solid ' + selectionColorFor(elementKind(el));
    selectedEl.style.outlineOffset = '2px';
    post('selected', {
      element: {
        frameId: el.dataset.frameId,
        blockId: el.dataset.blockId,
        componentId: el.dataset.blockId,
        componentPath: componentPath(el),
        elementKind: elementKind(el),
        tagName: el.tagName.toLowerCase(),
        selectorPath: selectorPath(el),
        textContent: (el.textContent || '').trim().slice(0, 160),
        outerHTML: el.outerHTML.slice(0, 800)
      }
    });
    initSelectionBox(el);
  }

  function deselect(notify) {
    if (selectedEl) {
      selectedEl.style.outline = '';
      selectedEl.style.outlineOffset = '';
    }
    selectedEl = null;
    removeSelectionBox();
    removeMeasureLayer();
    if (notify !== false) post('selected', { element: null });
  }

  function ensureInspectHitLayer() {
    ensureInteractionStyle();
    if (hitLayer && hitLayer.parentNode) return;
    hitLayer = document.createElement('div');
    hitLayer.className = '__fw_inspect_hit_layer';
    hitLayer.setAttribute('aria-hidden', 'true');

    hitLayer.addEventListener('mousemove', function(e) {
      if (!inspectMode) return;
      if (document.documentElement.classList.contains('__fw_interacting')) return;
      e.preventDefault();
      e.stopPropagation();
      var target = selectableFromEvent(e);
      if (!target || target === document.body || target === document.documentElement) {
        clearHover();
        return;
      }
      if (target === hoveredEl) return;
      clearHover();
      hoveredEl = target;
      if (hoveredEl !== selectedEl) {
        hoveredEl.style.outline = '2px dashed ' + hoverColor;
        hoveredEl.style.outlineOffset = '2px';
      }
    });

    hitLayer.addEventListener('mouseleave', function() {
      if (inspectMode) clearHover();
    });

    hitLayer.addEventListener('click', function(e) {
      if (!inspectMode) return;
      e.preventDefault();
      e.stopPropagation();
      var target = selectableFromEvent(e);
      if (!target || target === document.body || target === document.documentElement) return;
      ensureIds();
      select(target);
    });

    hitLayer.addEventListener('mousedown', function(e) {
      if (!inspectMode || !selectedEl) return;
      e.preventDefault();
      e.stopPropagation();
      var selectedRect = selectedEl.getBoundingClientRect();
      var insideSelected = e.clientX >= selectedRect.left &&
        e.clientX <= selectedRect.right &&
        e.clientY >= selectedRect.top &&
        e.clientY <= selectedRect.bottom;
      if (insideSelected) {
        startMove(e, selectedEl);
        return;
      }
      var target = selectableFromEvent(e);
      if (!target) return;
      if (selectedEl.contains(target)) startMove(e, selectedEl);
    });

    hitLayer.addEventListener('dblclick', function(e) {
      if (!inspectMode) return;
      e.preventDefault();
      e.stopPropagation();
      var target = selectableFromEvent(e);
      if (!target || target === document.body || target === document.documentElement) return;
      ensureIds();
      beginTextEdit(e, target);
    });

    document.body.appendChild(hitLayer);
  }

  function removeInspectHitLayer() {
    if (hitLayer && hitLayer.parentNode) hitLayer.parentNode.removeChild(hitLayer);
    hitLayer = null;
  }

  function bindResize(node, el, dir) {
    node.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      setInteractionActive(true);
      var before = rectOf(el);
      var guides = buildSnapGuides(el);
      var startX = e.clientX;
      var startY = e.clientY;
      var startW = before.width;
      var startH = before.height;
      var minW = 32;
      var minH = 24;
      var baseTranslate = getTranslate(el);
      var baseX = baseTranslate[0];
      var baseY = baseTranslate[1];

      function move(ev) {
        ev.preventDefault();
        var dx = ev.clientX - startX;
        var dy = ev.clientY - startY;
        var nextRect = {
          x: before.x,
          y: before.y,
          width: startW,
          height: startH
        };

        if (dir.indexOf('e') >= 0) nextRect.width = startW + dx;
        if (dir.indexOf('s') >= 0) nextRect.height = startH + dy;
        if (dir.indexOf('w') >= 0) {
          nextRect.width = startW - dx;
          nextRect.x = before.x + dx;
        }
        if (dir.indexOf('n') >= 0) {
          nextRect.height = startH - dy;
          nextRect.y = before.y + dy;
        }

        if (nextRect.width < minW) {
          if (dir.indexOf('w') >= 0) nextRect.x += nextRect.width - minW;
          nextRect.width = minW;
        }
        if (nextRect.height < minH) {
          if (dir.indexOf('n') >= 0) nextRect.y += nextRect.height - minH;
          nextRect.height = minH;
        }

        var snaps = { x: null, y: null };
        if (dir.indexOf('w') >= 0) {
          var leftSnap = bestSnap([{ value: nextRect.x, offset: 0 }], guides.x);
          if (leftSnap) {
            nextRect.x = leftSnap.guide;
            nextRect.width = before.x + before.width - nextRect.x;
            snaps.x = leftSnap.guide;
          }
        } else if (dir.indexOf('e') >= 0) {
          var rightSnap = bestSnap([{ value: nextRect.x + nextRect.width, offset: 0 }], guides.x);
          if (rightSnap) {
            nextRect.width = rightSnap.guide - nextRect.x;
            snaps.x = rightSnap.guide;
          }
        }
        if (dir.indexOf('n') >= 0) {
          var topSnap = bestSnap([{ value: nextRect.y, offset: 0 }], guides.y);
          if (topSnap) {
            nextRect.y = topSnap.guide;
            nextRect.height = before.y + before.height - nextRect.y;
            snaps.y = topSnap.guide;
          }
        } else if (dir.indexOf('s') >= 0) {
          var bottomSnap = bestSnap([{ value: nextRect.y + nextRect.height, offset: 0 }], guides.y);
          if (bottomSnap) {
            nextRect.height = bottomSnap.guide - nextRect.y;
            snaps.y = bottomSnap.guide;
          }
        }
        nextRect = roundedRect(nextRect);
        if (nextRect.width < minW) nextRect.width = minW;
        if (nextRect.height < minH) nextRect.height = minH;
        var nextX = baseX + (nextRect.x - before.x);
        var nextY = baseY + (nextRect.y - before.y);

        scheduleApply(function() {
          el.style.width = nextRect.width + 'px';
          el.style.height = nextRect.height + 'px';
          if (dir.indexOf('w') >= 0 || dir.indexOf('n') >= 0) {
            el.style.transform = 'translate3d(' + Math.round(nextX) + 'px, ' + Math.round(nextY) + 'px, 0)';
          }
          placeSelectionBox();
          updateMeasure(nextRect, snaps);
        });
      }

      function up() {
        setInteractionActive(false);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        removeMeasureLayer();
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
    var guides = buildSnapGuides(el);
    var startX = e.clientX;
    var startY = e.clientY;
    var baseTranslate = getTranslate(el);
    var baseX = baseTranslate[0];
    var baseY = baseTranslate[1];

    function move(ev) {
      ev.preventDefault();
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      var snapped = snapRect({
        x: before.x + dx,
        y: before.y + dy,
        width: before.width,
        height: before.height
      }, guides, { x: true, y: true });
      var nextX = Math.round(baseX + (snapped.rect.x - before.x));
      var nextY = Math.round(baseY + (snapped.rect.y - before.y));
      scheduleApply(function() {
        el.style.transform = 'translate3d(' + nextX + 'px, ' + nextY + 'px, 0)';
        el.style.willChange = 'transform';
        placeSelectionBox();
        updateMeasure(snapped.rect, snapped.snaps);
      });
    }

    function up() {
      setInteractionActive(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      el.style.willChange = '';
      removeMeasureLayer();
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
      document.documentElement.classList.toggle('__fw_inspect_mode', inspectMode);
      document.body.style.cursor = inspectMode ? 'crosshair' : '';
      if (inspectMode) ensureInspectHitLayer();
      else removeInspectHitLayer();
      clearHover();
      if (!inspectMode) deselect();
    }
    if (e.data.type === 'render-code') {
      applyRemoteHtml(e.data.html);
    }
  });

  window.addEventListener('resize', function() {
    if (selectedEl) placeSelectionBox();
  });

  window.addEventListener('scroll', function() {
    if (selectedEl) placeSelectionBox();
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
  const lastPreviewHtmlRef = useRef<string | null>(null);

  useEffect(() => {
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

    if (lastPreviewHtmlRef.current === code) return;

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
        lastPreviewHtmlRef.current = event.data.html;
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
      <div
        className="stage-shell"
      >
        {code ? (
          <>
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
          </>
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

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  role: Role;
  content: string;
}

export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type GestureType = 'move' | 'resize' | 'editText' | 'style';

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutContext {
  viewport: {
    width: number;
    height: number;
  };
  parent: {
    tagName: string;
    display: string;
    position: string;
    flexDirection: string;
    gridTemplateColumns: string;
    gap: string;
  } | null;
  layoutHint?: {
    intent: string;
    reason: string;
    siblingCount: number;
  } | null;
}

export interface GestureOperation {
  id: string;
  type: GestureType;
  targetKey: string;
  blockId?: string;
  componentId?: string;
  componentPath?: string[];
  version?: number;
  frameId: string;
  tagName: string;
  selectorPath: string;
  before: ElementRect | null;
  after: ElementRect | null;
  textBefore?: string;
  textAfter?: string;
  styleChange?: {
    property: string;
    after: string;
  };
  inlineStyleAfter: string;
  context: LayoutContext;
  createdAt: number;
}

export interface SelectedElement {
  frameId: string;
  blockId?: string;
  componentId?: string;
  componentPath?: string[];
  tagName: string;
  selectorPath: string;
  textContent: string;
  outerHTML: string;
}

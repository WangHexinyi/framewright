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

export type GestureType = 'move' | 'resize' | 'editText';

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
}

export interface GestureOperation {
  id: string;
  type: GestureType;
  frameId: string;
  tagName: string;
  selectorPath: string;
  before: ElementRect | null;
  after: ElementRect | null;
  textBefore?: string;
  textAfter?: string;
  inlineStyleAfter: string;
  context: LayoutContext;
  createdAt: number;
}

export interface SelectedElement {
  frameId: string;
  tagName: string;
  selectorPath: string;
  textContent: string;
  outerHTML: string;
}

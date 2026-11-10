// frontend/src/types/index.ts

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  ui_actions?: UIAction[];
}

export interface UIAction {
  action: string;
  data?: RouteData | Record<string, unknown>;
}

export interface RoutePoint {
  x: number;
  y: number;
  floor: number;
  node_id?: string;
}

export interface RouteData {
  path: RoutePoint[];
  path_nodes?: PathNode[];
  target_floor: number;
  estimated_time: string;
  destination_label: string;
  floors: number[];
}

export interface PathNode {
  node_id: string;
  label: string;
  floor: number;
  type: string;
  x: number;
  y: number;
}

export interface MapNode {
  id: string;
  floor: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  type: string;
  label: string;
  name?: string;
}

export interface MapEdge {
  from: string;
  to: string;
  weight: number;
  edge_type?: string;
}

export interface AssistantResponsePayload {
  text: string;
  intent: string;
  ui_actions: UIAction[];
  suggestions: string[];
  audio_url?: string | null;
  timestamp: string;
}
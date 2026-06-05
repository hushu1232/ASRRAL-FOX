import { BodyParams, EquippedPartData, MaterialOverride } from './avatar';

export type LightingPreset = 'studio' | 'outdoor' | 'night' | 'custom';
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export interface BlendShapeDefinition {
  name: string;
  displayName: string;
  category: string;
  index: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface EditCommand {
  readonly label: string;
  readonly timestamp: number;
  execute(): void;
  undo(): void;
}

export interface EditorState {
  avatarId: string | null;
  avatarName: string;
  baseModel: 'male' | 'female';
  blendShapes: Record<string, number>;
  equippedParts: Map<string, string>;
  selectedPartId: string | null;
  selectedBone: string | null;
  materialOverrides: Map<string, MaterialOverride>;
  bodyParams: BodyParams;
  undoStack: EditCommand[];
  redoStack: EditCommand[];
  currentAnimation: string | null;
  isPlaying: boolean;
  isLooping: boolean;
  animationProgress: number;
  lightingPreset: LightingPreset;
  environmentIntensity: number;
  backgroundColor: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
}

export const DEFAULT_LIGHTING_PRESETS: Record<LightingPreset, { intensity: number; bg: string }> = {
  studio: { intensity: 1.0, bg: '#1a1a2e' },
  outdoor: { intensity: 1.5, bg: '#87CEEB' },
  night: { intensity: 0.3, bg: '#0a0a15' },
  custom: { intensity: 1.0, bg: '#1a1a2e' },
};

/** Fixed node sizes (single source of truth for cards + layout). */
export const PERSON_SIZE = { width: 180, height: 96 } as const;
export const EVENT_SIZE = { width: 150, height: 64 } as const;
export const ERA_BAND = { width: 260, height: 2400 } as const;
/** Vertical gap between consecutive generation ranks (R1: y = rank * (cardH + RANK_GAP)). */
export const RANK_GAP = 120;
/** Legacy alias (pre-R1 layer pitch). Prefer RANK_GAP. */
export const LAYER_GAP = RANK_GAP;
/** Gap between a person row and a floating event card below it (R4). */
export const EVENT_GAP = 56;
/** Horizontal step between multiple events floating off the same anchor (R4). */
export const EVENT_SLOT_DX = 190;
export const SPOUSE_GAP = 24;
/** Gap between a node and side-placed (non-layered) neighbours, e.g. Lot. */
export const FREE_NODE_GAP = 96;
/** Inner padding between era content and its band border. */
export const ERA_BAND_PADDING = 48;
/** Vertical label strip reserved at the top of an era band. */
export const ERA_BAND_HEADER = 32;
/** Vertical gap between consecutive era bands. */
export const ERA_GAP = 80;
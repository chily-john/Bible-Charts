import { z } from "zod";

/** snake_case id, e.g. `abraham`, `the_flood`, `tree_of_life`. */
export const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, "id must be snake_case (a-z, 0-9, _)");

/** Span reference in Genesis-style forms: `Gen 12:1` or chapter-only `Gen 12`. */
export const spanSchema = z
  .object({
    start: z.string(),
    end: z.string(),
  })
  .strict();

export const nodeSchema = z
  .object({
    id: idSchema,
    kind: z.enum(["person", "event"]),
    label: z.string().min(1),
    subtitle: z.string().optional(),
    lineage: z.boolean().default(true),
    tags: z.array(idSchema).default([]),
    span: spanSchema.nullable().optional(),
    refs: z.array(z.string()).default([]),
    era: idSchema,
  })
  .strict();

export const edgeSchema = z
  .object({
    from: idSchema,
    to: idSchema,
    type: z.enum(["spouse", "parent", "encounter", "event"]),
    label: z.string().optional(),
    secondary: z.boolean().optional(),
  })
  .strict();

export const graphFileSchema = z
  .object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  })
  .strict();

export const eraSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
  })
  .strict();

export const erasFileSchema = z.array(eraSchema);

export const themeSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    summary: z.string().min(1),
    description: z.string().min(1),
    url: z.string().url().nullable(),
  })
  .strict();

export const themesFileSchema = z.array(themeSchema);

export type Span = z.infer<typeof spanSchema>;
export type NodeDraft = z.infer<typeof nodeSchema>;
export type EdgeDraft = z.infer<typeof edgeSchema>;
export type GraphFile = z.infer<typeof graphFileSchema>;
export type Era = z.infer<typeof eraSchema>;
export type Theme = z.infer<typeof themeSchema>;
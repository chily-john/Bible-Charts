import { PERSON_SIZE } from "../lib/sizes";

export const PERSON_SIZE_PROP = PERSON_SIZE;

export interface PersonCardData {
  label: string;
  subtitle?: string;
  [key: string]: unknown;
}

/** Fixed-size person node card stub (Wave 1: tags, lineage styling, ref badges). */
export default function PersonCard({ data }: { data: PersonCardData }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-slate-400 bg-white px-3 py-2 text-center shadow-sm"
      style={{ width: PERSON_SIZE.width, height: PERSON_SIZE.height }}
    >
      <div className="font-semibold text-slate-800">{data.label}</div>
      {data.subtitle ? (
        <div className="text-xs text-slate-500">{data.subtitle}</div>
      ) : null}
    </div>
  );
}
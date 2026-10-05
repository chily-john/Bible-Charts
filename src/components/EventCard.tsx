import { EVENT_SIZE } from "../lib/sizes";

export interface EventCardData {
  label: string;
  subtitle?: string;
  [key: string]: unknown;
}

/** Fixed-size event node card stub (Wave 1: theme chips, ref badges). */
export default function EventCard({ data }: { data: EventCardData }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-center shadow-sm"
      style={{ width: EVENT_SIZE.width, height: EVENT_SIZE.height }}
    >
      <div className="font-medium text-amber-900">{data.label}</div>
      {data.subtitle ? (
        <div className="text-xs text-amber-700">{data.subtitle}</div>
      ) : null}
    </div>
  );
}
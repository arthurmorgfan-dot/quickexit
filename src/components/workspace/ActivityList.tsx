import {
  ArrowUpRight,
  Check,
  Landmark,
  ShoppingBag,
  Target,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/demo-trading";
const icons = {
  buy: ShoppingBag,
  target: Target,
  sell: Check,
  bank: Landmark,
  info: ArrowUpRight,
};
export default function ActivityList({
  events,
  compact = false, scope = "Demo", startIndex = 0, totalCount = events.length,
}: {
  events: ActivityEvent[];
  compact?: boolean;
  scope?: "Demo" | "Account"; startIndex?: number; totalCount?: number;
}) {
  return (
    <ol className="qw-activity-list">
      {(compact ? events.slice(0, 4) : events).map((event, i) => {
        const Icon = icons[event.kind];
        return (
          <li key={event.id}>
            <span className={`qw-event-icon event-${event.kind}`}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <div>
              <p>{event.text}</p>
              <span>{scope === "Demo" ? i + startIndex === 0 ? "Latest demo event" : "This demo session" : i + startIndex === 0 ? "Latest account event" : "Account paper activity"}</span>
            </div>
            <span className="qw-event-order">
              {String(totalCount - startIndex - i).padStart(2, "0")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

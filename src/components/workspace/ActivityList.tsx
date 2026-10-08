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
  compact = false,
}: {
  events: ActivityEvent[];
  compact?: boolean;
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
              <span>{i === 0 ? "Latest demo event" : "This demo session"}</span>
            </div>
            <span className="qw-event-order">
              {String(events.length - i).padStart(2, "0")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

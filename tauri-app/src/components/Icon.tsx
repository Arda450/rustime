// components/Icon.tsx (optional)
import type { LucideIcon } from "lucide-react";

export function AppIcon({
  icon: Icon,
  size = 16,
}: {
  icon: LucideIcon;
  size?: number;
}) {
  return <Icon size={size} strokeWidth={2} aria-hidden className="appIcon" />;
}

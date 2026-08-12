import type { LucideIcon } from "lucide-react";

type ToolbarItem = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  tone?: "primary";
  onClick: () => void | Promise<void>;
};

type ToolbarProps = {
  items: ToolbarItem[];
};

export function Toolbar({ items }: ToolbarProps) {
  return (
    <div className="tool-grid">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            className={[item.active ? "is-active" : "", item.tone === "primary" ? "is-primary" : ""].filter(Boolean).join(" ")}
            onClick={item.onClick}
            title={item.label}
            aria-label={item.label}
            disabled={item.disabled}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

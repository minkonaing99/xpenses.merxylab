import { useRef, type PointerEvent } from "react";
import { Sheet } from "../../ui/Sheet";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  moveDashboardGroup,
  type DashboardGroup,
  type DashboardPreferences,
  type DashboardSection,
} from "./dashboardPreferences";

const LABELS: Record<DashboardSection, string> = {
  upcoming: "Upcoming",
  accounts: "Accounts",
  budgets: "Budgets",
  spend: "Where it went",
};
const GROUP_LABELS: Record<DashboardGroup, string> = {
  upcoming: "Upcoming",
  accountsBudgets: "Accounts and Budgets",
  spend: "Where it went",
};

export function DashboardCustomizer({ open, value, onChange, onClose }: {
  open: boolean;
  value: DashboardPreferences;
  onChange: (value: DashboardPreferences) => void;
  onClose: () => void;
}) {
  const set = (next: DashboardPreferences) => onChange(next);
  const dragging = useRef<DashboardGroup | null>(null);
  const reorder = (source: string, index: number) => {
    if (!value.order.includes(source as DashboardGroup)) return;
    const group = source as DashboardGroup;
    set(moveDashboardGroup(value, group, index - value.order.indexOf(group)));
  };
  const movePointer = (event: PointerEvent) => {
    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-dashboard-group]");
    const destination = target?.dataset.dashboardGroup;
    if (!dragging.current || !destination) return;
    reorder(dragging.current, value.order.indexOf(destination as DashboardGroup));
  };
  return <Sheet open={open} onClose={onClose} title="Customize dashboard">
    <div className="dash-customize">
      <p>Show, hide, and reorder dashboard groups.</p>
      {value.order.map((group, index) => <div className="dash-customize__group" key={group}
        data-dashboard-group={group}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => reorder(event.dataTransfer.getData("text/plain"), index)}>
        <button className="dash-customize__handle" aria-label={`Drag ${GROUP_LABELS[group]}`}
          draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", group)}
          onPointerDown={(event) => {
            dragging.current = group;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={movePointer}
          onPointerUp={() => { dragging.current = null; }}
          onPointerCancel={() => { dragging.current = null; }}>Grip</button>
        <strong>{GROUP_LABELS[group]}</strong>
        <button disabled={index === 0} onClick={() => set(moveDashboardGroup(value, group, -1))} aria-label={`Move ${GROUP_LABELS[group]} up`}>Up</button>
        <button disabled={index === value.order.length - 1} onClick={() => set(moveDashboardGroup(value, group, 1))} aria-label={`Move ${GROUP_LABELS[group]} down`}>Down</button>
      </div>)}
      <fieldset><legend>Visible sections</legend>
        {(Object.keys(LABELS) as DashboardSection[]).map((section) => <label key={section}>
          <input type="checkbox" checked={value.visible[section]} onChange={() => set({
            ...value,
            visible: { ...value.visible, [section]: !value.visible[section] },
          })} /> {LABELS[section]}
        </label>)}
      </fieldset>
      <button className="dash-customize__reset" onClick={() => set({
        order: [...DEFAULT_DASHBOARD_PREFERENCES.order],
        visible: { ...DEFAULT_DASHBOARD_PREFERENCES.visible },
      })}>Reset</button>
    </div>
  </Sheet>;
}

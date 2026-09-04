export type DashboardGroup = "upcoming" | "accountsBudgets" | "spend";
export type DashboardSection = "upcoming" | "accounts" | "budgets" | "spend";

export interface DashboardPreferences {
  order: DashboardGroup[];
  visible: Record<DashboardSection, boolean>;
}

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  order: ["upcoming", "accountsBudgets", "spend"],
  visible: { upcoming: true, accounts: true, budgets: true, spend: true },
};

const KEY = "xpenses.dashboard-layout.v1";
const GROUPS = new Set(DEFAULT_DASHBOARD_PREFERENCES.order);

export function loadDashboardPreferences(storage: Pick<Storage, "getItem"> = localStorage): DashboardPreferences {
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? "null") as Partial<DashboardPreferences> | null;
    const order = value?.order;
    const visible = value?.visible;
    if (!Array.isArray(order) || order.length !== 3 || new Set(order).size !== 3 || !order.every((item) => GROUPS.has(item))) {
      return copyDefaults();
    }
    if (!visible || Object.values(visible).some((item) => typeof item !== "boolean")) return copyDefaults();
    return { order: [...order], visible: { ...DEFAULT_DASHBOARD_PREFERENCES.visible, ...visible } };
  } catch {
    return copyDefaults();
  }
}

export function saveDashboardPreferences(value: DashboardPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function moveDashboardGroup(value: DashboardPreferences, group: DashboardGroup, delta: number): DashboardPreferences {
  const from = value.order.indexOf(group);
  const to = Math.max(0, Math.min(value.order.length - 1, from + delta));
  const order = value.order.filter((item) => item !== group);
  order.splice(to, 0, group);
  return { ...value, order };
}

function copyDefaults(): DashboardPreferences {
  return { order: [...DEFAULT_DASHBOARD_PREFERENCES.order], visible: { ...DEFAULT_DASHBOARD_PREFERENCES.visible } };
}

const DASHBOARD_SELECTION_STORAGE_KEY = "parking-radar:dashboard-selection:v1";

export type StoredDashboardSelection = {
  airportCode: string;
  parkingLotId: number | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function canUseStorage(storage: StorageLike | null | undefined): storage is StorageLike {
  return storage !== null && storage !== undefined;
}

export function readStoredDashboardSelection(
  storage: StorageLike | null | undefined = typeof window !== "undefined" ? window.localStorage : null
): StoredDashboardSelection | null {
  if (!canUseStorage(storage)) {
    return null;
  }

  const raw = storage.getItem(DASHBOARD_SELECTION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDashboardSelection>;
    if (typeof parsed.airportCode !== "string") {
      return null;
    }

    return {
      airportCode: parsed.airportCode,
      parkingLotId: typeof parsed.parkingLotId === "number" ? parsed.parkingLotId : null,
    };
  } catch {
    return null;
  }
}

export function writeStoredDashboardSelection(
  selection: StoredDashboardSelection,
  storage: StorageLike | null | undefined = typeof window !== "undefined" ? window.localStorage : null
): void {
  if (!canUseStorage(storage)) {
    return;
  }

  storage.setItem(DASHBOARD_SELECTION_STORAGE_KEY, JSON.stringify(selection));
}

export { DASHBOARD_SELECTION_STORAGE_KEY };

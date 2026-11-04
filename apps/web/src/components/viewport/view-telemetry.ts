"use client";

import { create } from "zustand";

/** Camera geometry for the HUD (definitional view geometry, not scientific data). */
export interface ViewTelemetry {
  subLatitudeDeg: number | null;
  subLongitudeDeg: number | null;
  altitudeKm: number | null;
  set: (t: { subLatitudeDeg: number; subLongitudeDeg: number; altitudeKm: number }) => void;
}

export const useViewTelemetry = create<ViewTelemetry>()((set) => ({
  subLatitudeDeg: null,
  subLongitudeDeg: null,
  altitudeKm: null,
  set: (t) => set(t),
}));

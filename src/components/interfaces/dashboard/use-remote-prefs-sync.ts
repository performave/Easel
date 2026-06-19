import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  colorsQueryOptions,
  courseNicknamesQueryOptions,
  currentUserQueryOptions,
  dashboardPositionsQueryOptions,
} from "@/lib/queries";
import { parseColors, parseNicknames, parsePositionsOrder } from "@/lib/context-codes";
import { useDashboardPrefsStore } from "@/stores/dashboard-prefs";

/**
 * Pulls the user's Canvas-side dashboard prefs (nicknames, positions, colors)
 * and merges them into the local store. Returns the current user id, which
 * the course grid needs to sync reordering back to Canvas.
 */
export function useRemotePrefsSync(): number | null {
  const hydrateRemote = useDashboardPrefsStore((s) => s.hydrateRemote);

  const { data: user } = useQuery(currentUserQueryOptions());
  const userId = user?.id ?? null;

  const nicknamesQuery = useQuery(courseNicknamesQueryOptions());
  const positionsQuery = useQuery({ ...dashboardPositionsQueryOptions(userId ?? 0), enabled: userId != null });
  const colorsQuery = useQuery({ ...colorsQueryOptions(userId ?? 0), enabled: userId != null });

  useEffect(() => {
    hydrateRemote({
      order: positionsQuery.data ? parsePositionsOrder(positionsQuery.data.dashboard_positions) : undefined,
      nicknames: nicknamesQuery.data ? parseNicknames(nicknamesQuery.data) : undefined,
      colors: colorsQuery.data ? parseColors(colorsQuery.data.custom_colors) : undefined,
    });
  }, [hydrateRemote, nicknamesQuery.data, positionsQuery.data, colorsQuery.data]);

  return userId;
}

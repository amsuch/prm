import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/auth/ctx";
import type { Tables } from "@/types/database";

export type RecentInteraction = Tables<"interactions"> & {
  contact_first_name: string;
  contact_last_name: string | null;
  contact_avatar_url: string | null;
};

export type UpcomingBirthday = {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  birthday: string;
  days_until: number;
};

export type DashboardStats = {
  totalContacts: number;
  contactedThisWeek: number;
  staleContacts: number;
};

export type DashboardData = {
  stats: DashboardStats;
  recentInteractions: RecentInteraction[];
  upcomingBirthdays: UpcomingBirthday[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useDashboard(): DashboardData {
  const { session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    contactedThisWeek: 0,
    staleContacts: 0,
  });
  const [recentInteractions, setRecentInteractions] = useState<RecentInteraction[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const fetchDashboard = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();

      // 1. Total contacts count
      const { count: totalCount, error: totalError } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_archived", false);

      if (totalError) throw totalError;

      // 2. Contacted this week (contacts with an interaction in the last 7 days)
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: contactedData, error: contactedError } = await supabase
        .from("interactions")
        .select("contact_id")
        .eq("user_id", userId)
        .gte("occurred_at", sevenDaysAgo.toISOString());

      if (contactedError) throw contactedError;

      const uniqueContactedIds = new Set(
        ((contactedData ?? []) as unknown as { contact_id: string }[]).map(
          (row) => row.contact_id,
        ),
      );

      // 3. Stale contacts (not contacted in 30+ days)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: staleCount, error: staleError } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_archived", false)
        .or(
          `last_contacted_at.is.null,last_contacted_at.lt.${thirtyDaysAgo.toISOString()}`,
        );

      if (staleError) throw staleError;

      setStats({
        totalContacts: totalCount ?? 0,
        contactedThisWeek: uniqueContactedIds.size,
        staleContacts: staleCount ?? 0,
      });

      // 4. Recent interactions (last 10 across all contacts, joined with contact name)
      const { data: interactionsData, error: interactionsError } = await supabase
        .from("interactions")
        .select(
          `
          *,
          contacts!inner (first_name, last_name, avatar_url)
        `,
        )
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(10);

      if (interactionsError) throw interactionsError;

      const mappedInteractions: RecentInteraction[] = (interactionsData ?? []).map(
        (row: Record<string, unknown>) => {
          const contacts = row.contacts as {
            first_name: string;
            last_name: string | null;
            avatar_url: string | null;
          };
          return {
            id: row.id as string,
            user_id: row.user_id as string,
            contact_id: row.contact_id as string,
            type: row.type as string,
            direction: row.direction as string | null,
            title: row.title as string | null,
            body: row.body as string | null,
            occurred_at: row.occurred_at as string,
            metadata: row.metadata as Tables<"interactions">["metadata"],
            created_at: row.created_at as string,
            contact_first_name: contacts.first_name,
            contact_last_name: contacts.last_name,
            contact_avatar_url: contacts.avatar_url,
          };
        },
      );

      setRecentInteractions(mappedInteractions);

      // 5. Upcoming birthdays this month
      const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
      const currentDay = now.getDate();

      type BirthdayRow = {
        id: string;
        first_name: string;
        last_name: string | null;
        avatar_url: string | null;
        birthday: string | null;
      };

      const { data: birthdayData, error: birthdayError } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, avatar_url, birthday")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .not("birthday", "is", null);

      if (birthdayError) throw birthdayError;

      const typedBirthdayData = (birthdayData ?? []) as unknown as BirthdayRow[];

      const birthdays: UpcomingBirthday[] = typedBirthdayData
        .filter((c) => {
          if (!c.birthday) return false;
          const bMonth = c.birthday.slice(5, 7);
          return bMonth === currentMonth;
        })
        .map((c) => {
          const bDay = parseInt(c.birthday!.slice(8, 10), 10);
          const daysUntil = bDay >= currentDay ? bDay - currentDay : 0;
          return {
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            avatar_url: c.avatar_url,
            birthday: c.birthday!,
            days_until: daysUntil,
          };
        })
        .filter((b) => b.days_until >= 0)
        .sort((a, b) => a.days_until - b.days_until);

      setUpcomingBirthdays(birthdays);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch dashboard data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    stats,
    recentInteractions,
    upcomingBirthdays,
    isLoading,
    error,
    refetch: fetchDashboard,
  };
}

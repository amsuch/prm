import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { useDashboard } from "@/hooks/useDashboard";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { DashboardStats } from "@/components/DashboardStats";
import { RecentActivity } from "@/components/RecentActivity";
import { getInitials, formatDate } from "@/lib/utils";
import { Colors } from "@/constants/colors";

export default function HomeScreen() {
  const { session } = useSession();
  const { stats, recentInteractions, upcomingBirthdays, isLoading, refetch } =
    useDashboard();
  const { isConnected: calendarConnected, pendingSuggestionsCount } =
    useCalendarSync();

  const name =
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split("@")[0] ||
    "there";

  return (
    <ScrollView
      className="flex-1 bg-stone-50"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.brand[600]} />
      }
    >
      <View className="px-4 pt-5 pb-24">
        {/* Greeting */}
        <Text className="text-2xl font-bold text-stone-900">Hi, {name}</Text>
        <Text className="mt-1 text-stone-500">
          Your relationship dashboard
        </Text>

        {/* Quick Actions */}
        <View className="mt-6 flex-row gap-3">
          <Pressable
            onPress={() => router.push("/(app)/contact/new")}
            className="flex-1 items-center rounded-xl bg-indigo-600 py-4 active:bg-indigo-700"
          >
            <Ionicons name="person-add-outline" size={22} color="white" />
            <Text className="mt-1 text-sm font-medium text-white">
              Add Contact
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/import")}
            className="flex-1 items-center rounded-xl bg-white py-4 shadow-sm active:bg-stone-50"
          >
            <Ionicons name="download-outline" size={22} color={Colors.brand[600]} />
            <Text className="mt-1 text-sm font-medium text-stone-700">
              Import
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/(tabs)/contacts")}
            className="flex-1 items-center rounded-xl bg-white py-4 shadow-sm active:bg-stone-50"
          >
            <Ionicons name="search-outline" size={22} color={Colors.brand[600]} />
            <Text className="mt-1 text-sm font-medium text-stone-700">
              Search
            </Text>
          </Pressable>
        </View>

        {/* Stats */}
        <Text className="mb-3 mt-8 text-lg font-semibold text-stone-900">
          Overview
        </Text>
        <DashboardStats stats={stats} isLoading={isLoading} />

        {/* Calendar Suggestions Card */}
        {calendarConnected && pendingSuggestionsCount > 0 && (
          <Pressable
            onPress={() => router.push("/(app)/calendar-suggestions" as never)}
            className="mt-6 flex-row items-center rounded-xl bg-amber-50 px-4 py-3.5 shadow-sm active:bg-amber-100"
          >
            <Ionicons name="calendar-outline" size={20} color="#b45309" />
            <Text className="ml-2.5 flex-1 text-sm font-medium text-amber-800">
              {pendingSuggestionsCount} calendar suggestion
              {pendingSuggestionsCount !== 1 ? "s" : ""} to review
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#b45309" />
          </Pressable>
        )}

        {/* Recent Activity */}
        <Text className="mb-3 mt-8 text-lg font-semibold text-stone-900">
          Recent Activity
        </Text>
        <RecentActivity
          interactions={recentInteractions}
          isLoading={isLoading}
        />

        {/* Upcoming Birthdays */}
        {upcomingBirthdays.length > 0 && (
          <>
            <Text className="mb-3 mt-8 text-lg font-semibold text-stone-900">
              Upcoming Birthdays
            </Text>
            <View className="overflow-hidden rounded-xl bg-white shadow-sm">
              {upcomingBirthdays.map((birthday, index) => {
                const initials = getInitials(
                  birthday.first_name,
                  birthday.last_name,
                );
                const fullName = [birthday.first_name, birthday.last_name]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <View key={birthday.id}>
                    {index > 0 && <View className="ml-17 h-px bg-stone-100" />}
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/(app)/contact/${birthday.id}` as const,
                        )
                      }
                      className="flex-row items-center px-4 py-3 active:bg-stone-50"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-100">
                        <Text className="text-sm font-semibold text-pink-700">
                          {initials}
                        </Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-semibold text-stone-900">
                          {fullName}
                        </Text>
                        <Text className="mt-0.5 text-xs text-stone-500">
                          {formatDate(birthday.birthday)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Ionicons name="gift-outline" size={16} color="#ec4899" />
                        <Text className="mt-0.5 text-xs font-medium text-pink-600">
                          {birthday.days_until === 0
                            ? "Today!"
                            : birthday.days_until === 1
                              ? "Tomorrow"
                              : `In ${birthday.days_until} days`}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

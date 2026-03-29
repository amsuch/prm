import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/auth/ctx";
import { useDashboard } from "@/hooks/useDashboard";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { DashboardStats } from "@/components/DashboardStats";
import { RecentActivity } from "@/components/RecentActivity";
import { AnimatedPressable } from "@/components/AnimatedPressable";
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
      className="flex-1 bg-stone-50 dark:bg-stone-950"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.brand[600]} />
      }
    >
      <View className="px-4 pt-6 pb-24">
        {/* Greeting */}
        <Animated.View entering={FadeIn.duration(300)}>
          <Text className="text-3xl font-bold text-stone-900 dark:text-stone-100">Hi, {name}</Text>
          <Text className="mt-1 text-base text-stone-500 dark:text-stone-400">
            Your relationship dashboard
          </Text>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(100).duration(400).springify()} className="mt-6 flex-row gap-3">
          <AnimatedPressable
            scaleDown={0.95}
            onPress={() => router.push("/(app)/contact/new")}
            className="flex-1 items-center rounded-xl bg-indigo-600 py-4 active:bg-indigo-700 dark:bg-indigo-500 dark:active:bg-indigo-600"
          >
            <Ionicons name="person-add-outline" size={22} color="white" />
            <Text className="mt-1 text-sm font-medium text-white">
              Add Contact
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            scaleDown={0.95}
            onPress={() => router.push("/(app)/(tabs)/import")}
            className="flex-1 items-center rounded-xl bg-white py-4 shadow-sm active:bg-stone-50 dark:bg-stone-900 dark:border dark:border-stone-800 dark:active:bg-stone-800"
          >
            <Ionicons name="download-outline" size={22} color={Colors.brand[600]} />
            <Text className="mt-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Import
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            scaleDown={0.95}
            onPress={() => router.push("/(app)/(tabs)/contacts")}
            className="flex-1 items-center rounded-xl bg-white py-4 shadow-sm active:bg-stone-50 dark:bg-stone-900 dark:border dark:border-stone-800 dark:active:bg-stone-800"
          >
            <Ionicons name="search-outline" size={22} color={Colors.brand[600]} />
            <Text className="mt-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Search
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInUp.delay(200).duration(400).springify()}>
          <Text className="mb-3 mt-10 text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Overview
          </Text>
          <DashboardStats stats={stats} isLoading={isLoading} />
        </Animated.View>

        {/* Calendar Suggestions Card */}
        {calendarConnected && pendingSuggestionsCount > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(400).springify()}>
            <AnimatedPressable
              scaleDown={0.98}
              onPress={() => router.push("/(app)/calendar-suggestions" as never)}
              className="mt-6 flex-row items-center rounded-xl bg-amber-50 px-4 py-3.5 shadow-sm active:bg-amber-100 dark:bg-amber-950 dark:border dark:border-stone-800 dark:active:bg-amber-900"
            >
              <Ionicons name="calendar-outline" size={20} color="#b45309" />
              <Text className="ml-2.5 flex-1 text-sm font-medium text-amber-800 dark:text-amber-300">
                {pendingSuggestionsCount} calendar suggestion
                {pendingSuggestionsCount !== 1 ? "s" : ""} to review
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#b45309" />
            </AnimatedPressable>
          </Animated.View>
        )}

        {/* Recent Activity */}
        <Animated.View entering={FadeInUp.delay(300).duration(400).springify()}>
          <Text className="mb-3 mt-10 text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Recent Activity
          </Text>
          <RecentActivity
            interactions={recentInteractions}
            isLoading={isLoading}
          />
        </Animated.View>

        {/* Upcoming Birthdays */}
        {upcomingBirthdays.length > 0 && (
          <Animated.View entering={FadeInUp.delay(400).duration(400).springify()}>
            <Text className="mb-3 mt-10 text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              Upcoming Birthdays
            </Text>
            <View className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-stone-900 dark:border dark:border-stone-800">
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
                    {index > 0 && <View className="ml-17 h-px bg-stone-100 dark:bg-stone-800" />}
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/(app)/contact/${birthday.id}` as const,
                        )
                      }
                      className="flex-row items-center px-4 py-3 active:bg-stone-50 dark:active:bg-stone-800"
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-900">
                        <Text className="text-sm font-semibold text-pink-700 dark:text-pink-300">
                          {initials}
                        </Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {fullName}
                        </Text>
                        <Text className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                          {formatDate(birthday.birthday)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Ionicons name="gift-outline" size={16} color="#ec4899" />
                        <Text className="mt-0.5 text-xs font-medium text-pink-600 dark:text-pink-400">
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
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}

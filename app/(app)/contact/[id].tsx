import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ContactHeader } from "@/components/ContactHeader";
import { TagPills } from "@/components/TagPills";
import { InteractionTimeline } from "@/components/InteractionTimeline";
import { RelationshipsList } from "@/components/RelationshipsList";
import { CustomFieldsView } from "@/components/CustomFieldsView";
import { AddRelationshipModal } from "@/components/AddRelationshipModal";
import { LogInteractionModal } from "@/components/LogInteractionModal";
import { useContact } from "@/hooks/useContact";
import { useInteractions } from "@/hooks/useInteractions";
import { useRelationships } from "@/hooks/useRelationships";
import { useCustomFieldDefinitions } from "@/hooks/useCustomFieldDefinitions";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { Colors } from "@/constants/colors";

type SectionId = "info" | "tags" | "custom" | "notes";

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { contact, isLoading, error, refetch } = useContact(id);
  const {
    interactions,
    groupedInteractions,
    isLoading: interactionsLoading,
    error: interactionsError,
    refresh: refreshInteractions,
  } = useInteractions(id);
  const {
    relationships,
    groupedRelationships,
    isLoading: relationshipsLoading,
    error: relationshipsError,
    refresh: refreshRelationships,
  } = useRelationships(id);
  const { definitions } = useCustomFieldDefinitions();

  const [collapsedSections, setCollapsedSections] = useState<Set<SectionId>>(new Set());
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [showLogInteraction, setShowLogInteraction] = useState(false);

  const toggleSection = (section: SectionId) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const fullName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : "";

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color={Colors.brand[600]} />
        <Text className="mt-3 text-sm text-gray-400">Loading contact...</Text>
      </View>
    );
  }

  if (error || !contact) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text className="mt-3 text-center text-base font-medium text-gray-700">
          {error ?? "Contact not found"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-lg bg-blue-600 px-5 py-2 active:bg-blue-700"
        >
          <Text className="text-sm font-medium text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const tags = contact.contact_tags?.map((ct) => ct.tags).filter(Boolean) ?? [];
  const interactionCount = interactions.length;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <ContactHeader contact={contact} />

        {/* Stats Bar */}
        <View className="mx-4 mt-3 flex-row rounded-xl bg-white p-3 shadow-sm">
          <View className="flex-1 items-center border-r border-gray-100">
            <Text className="text-xs text-gray-400">Last Contacted</Text>
            <Text className="mt-0.5 text-sm font-semibold text-gray-700">
              {formatRelativeTime(contact.last_contacted_at)}
            </Text>
          </View>
          <View className="flex-1 items-center border-r border-gray-100">
            <Text className="text-xs text-gray-400">Interactions</Text>
            <Text className="mt-0.5 text-sm font-semibold text-gray-700">
              {interactionCount}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-xs text-gray-400">Connected</Text>
            <Text className="mt-0.5 text-sm font-semibold text-gray-700">
              {formatDate(contact.created_at)}
            </Text>
          </View>
        </View>

        {/* Contact Info Section */}
        <SectionHeader
          title="Contact Info"
          sectionId="info"
          isCollapsed={collapsedSections.has("info")}
          onToggle={toggleSection}
        />
        {!collapsedSections.has("info") && (
          <View className="mx-4 rounded-xl bg-white p-4 shadow-sm">
            {/* Emails */}
            {contact.contact_emails.length > 0 && (
              <View className="mb-3">
                {contact.contact_emails.map((email) => (
                  <Pressable
                    key={email.id}
                    onPress={() => Linking.openURL(`mailto:${email.email}`)}
                    className="mb-1.5 flex-row items-center rounded-lg bg-gray-50 p-2.5 active:bg-gray-100"
                  >
                    <Ionicons name="mail-outline" size={16} color={Colors.brand[600]} />
                    <View className="ml-2 flex-1">
                      <Text className="text-sm text-blue-600">{email.email}</Text>
                      <Text className="text-xs capitalize text-gray-400">
                        {email.label}
                        {email.is_primary ? " (primary)" : ""}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={14} color={Colors.gray[300]} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Phones */}
            {contact.contact_phones.length > 0 && (
              <View className="mb-3">
                {contact.contact_phones.map((phone) => (
                  <Pressable
                    key={phone.id}
                    onPress={() => Linking.openURL(`tel:${phone.phone}`)}
                    className="mb-1.5 flex-row items-center rounded-lg bg-gray-50 p-2.5 active:bg-gray-100"
                  >
                    <Ionicons name="call-outline" size={16} color="#16a34a" />
                    <View className="ml-2 flex-1">
                      <Text className="text-sm text-gray-800">{phone.phone}</Text>
                      <Text className="text-xs capitalize text-gray-400">
                        {phone.label}
                        {phone.is_primary ? " (primary)" : ""}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={14} color={Colors.gray[300]} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* URLs */}
            {contact.contact_urls.length > 0 && (
              <View>
                {contact.contact_urls.map((url) => (
                  <Pressable
                    key={url.id}
                    onPress={() => Linking.openURL(url.url)}
                    className="mb-1.5 flex-row items-center rounded-lg bg-gray-50 p-2.5 active:bg-gray-100"
                  >
                    <Ionicons name="link-outline" size={16} color="#7c3aed" />
                    <View className="ml-2 flex-1">
                      <Text className="text-sm text-blue-600" numberOfLines={1}>
                        {url.url}
                      </Text>
                      <Text className="text-xs capitalize text-gray-400">
                        {url.label}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={14} color={Colors.gray[300]} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Empty state for contact info */}
            {contact.contact_emails.length === 0 &&
              contact.contact_phones.length === 0 &&
              contact.contact_urls.length === 0 && (
                <Text className="py-2 text-center text-sm text-gray-400">
                  No contact information added
                </Text>
              )}
          </View>
        )}

        {/* Tags Section */}
        {tags.length > 0 && (
          <>
            <SectionHeader
              title="Tags"
              sectionId="tags"
              isCollapsed={collapsedSections.has("tags")}
              onToggle={toggleSection}
            />
            {!collapsedSections.has("tags") && (
              <View className="mx-4 rounded-xl bg-white p-4 shadow-sm">
                <TagPills tags={tags} />
              </View>
            )}
          </>
        )}

        {/* Relationships Section (self-contained with header) */}
        <RelationshipsList
          groupedRelationships={groupedRelationships}
          isLoading={relationshipsLoading}
          error={relationshipsError}
          onAddPress={() => setShowAddRelationship(true)}
          onRefresh={refreshRelationships}
        />

        {/* Interactions Timeline (self-contained with header) */}
        <InteractionTimeline
          groupedInteractions={groupedInteractions}
          isLoading={interactionsLoading}
          error={interactionsError}
          onLogPress={() => setShowLogInteraction(true)}
          onRefresh={refreshInteractions}
        />

        {/* Custom Fields Section */}
        {definitions.length > 0 && (
          <>
            <SectionHeader
              title="Custom Fields"
              sectionId="custom"
              isCollapsed={collapsedSections.has("custom")}
              onToggle={toggleSection}
            />
            {!collapsedSections.has("custom") && (
              <View className="mx-4 rounded-xl bg-white p-4 shadow-sm">
                <CustomFieldsView
                  customFields={contact.custom_fields}
                  definitions={definitions}
                />
              </View>
            )}
          </>
        )}

        {/* Notes Section */}
        {contact.notes && (
          <>
            <SectionHeader
              title="Notes"
              sectionId="notes"
              isCollapsed={collapsedSections.has("notes")}
              onToggle={toggleSection}
            />
            {!collapsedSections.has("notes") && (
              <View className="mx-4 rounded-xl bg-white p-4 shadow-sm">
                <Text className="text-sm leading-5 text-gray-700">{contact.notes}</Text>
              </View>
            )}
          </>
        )}

        {/* Source Info */}
        {contact.source && (
          <View className="mx-4 mt-4 mb-4 flex-row items-center justify-center">
            <Ionicons name="information-circle-outline" size={14} color={Colors.gray[300]} />
            <Text className="ml-1 text-xs text-gray-300">
              Source: {contact.source}
              {contact.source_id ? ` (${contact.source_id})` : ""}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 flex-row border-t border-gray-100 bg-white px-4 pb-8 pt-3">
        <Pressable
          onPress={() => router.push(`/contact/${id}/edit`)}
          className="mr-2 flex-1 flex-row items-center justify-center rounded-xl border border-gray-200 bg-white py-3 active:bg-gray-50"
        >
          <Ionicons name="create-outline" size={18} color={Colors.gray[700]} />
          <Text className="ml-2 text-sm font-semibold text-gray-700">Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowLogInteraction(true)}
          className="ml-2 flex-1 flex-row items-center justify-center rounded-xl bg-blue-600 py-3 active:bg-blue-700"
        >
          <Ionicons name="add-circle-outline" size={18} color="white" />
          <Text className="ml-2 text-sm font-semibold text-white">Log Interaction</Text>
        </Pressable>
      </View>

      {/* Add Relationship Modal */}
      <AddRelationshipModal
        visible={showAddRelationship}
        onClose={() => setShowAddRelationship(false)}
        onAdded={refreshRelationships}
        contactId={id!}
        existingRelationships={relationships}
      />

      {/* Log Interaction Modal */}
      <LogInteractionModal
        visible={showLogInteraction}
        onClose={() => setShowLogInteraction(false)}
        onLogged={() => {
          refreshInteractions();
          refetch();
        }}
        contactId={id!}
        contactName={fullName}
      />
    </View>
  );
}

// --- Section Header Component ---

type SectionHeaderProps = {
  title: string;
  sectionId: SectionId;
  isCollapsed: boolean;
  onToggle: (id: SectionId) => void;
};

function SectionHeader({
  title,
  sectionId,
  isCollapsed,
  onToggle,
}: SectionHeaderProps) {
  return (
    <Pressable
      onPress={() => onToggle(sectionId)}
      className="mx-4 mt-4 mb-2 flex-row items-center justify-between"
    >
      <Text className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </Text>
      <Ionicons
        name={isCollapsed ? "chevron-down" : "chevron-up"}
        size={16}
        color={Colors.gray[400]}
      />
    </Pressable>
  );
}

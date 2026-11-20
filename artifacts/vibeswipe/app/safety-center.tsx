import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getGetMyLocationShareQueryKey,
  getListEmergencyContactsQueryKey,
  useAddEmergencyContact,
  useCreateLocationShare,
  useDeleteEmergencyContact,
  useGetMyLocationShare,
  useListEmergencyContacts,
  useStopLocationShare,
  useUpdateLocationShare,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

const PUBLIC_WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_URL ?? "https://myage.beauty";

export default function SafetyCenterScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const contacts = useListEmergencyContacts();
  const addContact = useAddEmergencyContact();
  const deleteContact = useDeleteEmergencyContact();
  const locationShare = useGetMyLocationShare({
    query: { refetchInterval: 30_000, refetchOnWindowFocus: true },
  });
  const createLocationShare = useCreateLocationShare();
  const updateLocationShare = useUpdateLocationShare();
  const stopLocationShare = useStopLocationShare();
  const [permission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactError, setContactError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (locationShare.data) {
      setShareId(locationShare.data.shareId);
    }
  }, [locationShare.data?.shareId]);

  useEffect(() => {
    if (!shareId || !permission?.granted) return;

    let mounted = true;
    let subscription: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15_000,
        distanceInterval: 15,
      },
      (position) => {
        updateLocationShare.mutate({
          shareId,
          data: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }, {
          onError: () => {
            setLocationError("Live location could not update. Check your connection and try again.");
          },
        });
      },
    )
      .then((watch) => {
        if (mounted) {
          subscription = watch;
          watchRef.current = watch;
        } else {
          watch.remove();
        }
      })
      .catch(() => {
        setLocationError("Live updates could not start. Keep this screen open and try again.");
      });

    return () => {
      mounted = false;
      subscription?.remove();
      if (watchRef.current === subscription) watchRef.current = null;
    };
  }, [shareId, permission?.granted]);

  async function saveContact() {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || cleanPhone.length < 7) {
      setContactError("Enter a name and a phone number with at least 7 characters.");
      return;
    }
    if ((contacts.data?.length ?? 0) >= 3) {
      setContactError("You can save up to three emergency contacts.");
      return;
    }

    setContactError("");
    try {
      await addContact.mutateAsync({ data: { name: cleanName, phone: cleanPhone } });
      setName("");
      setPhone("");
      await queryClient.invalidateQueries({
        queryKey: getListEmergencyContactsQueryKey(),
      });
    } catch {
      setContactError("Could not save this contact. Check the details and try again.");
    }
  }

  function confirmDeleteContact(contactId: string, contactName: string) {
    Alert.alert("Remove emergency contact?", `Remove ${contactName} from your saved contacts?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void deleteContact
            .mutateAsync({ contactId })
            .then(() =>
              queryClient.invalidateQueries({
                queryKey: getListEmergencyContactsQueryKey(),
              }),
            )
            .catch(() => setContactError("Could not remove this contact. Try again."));
        },
      },
    ]);
  }

  async function shareLinkWithFriend(link: string) {
    try {
      await Share.share({
        title: "VIBESWIPES live location",
        message: `My live location link: ${link}`,
        url: link,
      });
    } catch {
      setLocationError("The link is ready, but your phone could not open the share menu.");
    }
  }

  async function startLocationShare() {
    setLocationError("");
    setNotice("");
    let allowed = permission;
    if (!allowed?.granted) {
      try {
        allowed = await requestLocationPermission();
      } catch {
        setLocationError("Location permission could not be requested.");
        return;
      }
    }
    if (!allowed?.granted) {
      setLocationError(
        allowed?.canAskAgain
          ? "Allow location access to share your live location."
          : "Location access is off. Open Settings to allow it, then try again.",
      );
      return;
    }

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const created = await createLocationShare.mutateAsync({
        data: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        },
      });
      const link = `${PUBLIC_WEB_BASE}/safety/location?token=${encodeURIComponent(created.token)}`;
      setShareId(created.shareId);
      setShareLink(link);
      await queryClient.invalidateQueries({
        queryKey: getGetMyLocationShareQueryKey(),
      });
      setNotice("The link is ready. Choose a friend in your phone's share menu.");
      await shareLinkWithFriend(link);
    } catch {
      setLocationError("Could not start location sharing. Check your connection and try again.");
    }
  }

  async function stopSharing() {
    if (!shareId) return;
    setLocationError("");
    try {
      await stopLocationShare.mutateAsync({ shareId });
      watchRef.current?.remove();
      watchRef.current = null;
      setShareId(null);
      setShareLink(null);
      setNotice("Location sharing has stopped.");
      await queryClient.invalidateQueries({
        queryKey: getGetMyLocationShareQueryKey(),
      });
    } catch {
      setLocationError("Could not stop location sharing. Please try again.");
    }
  }

  async function openLocationSettings() {
    try {
      await Linking.openSettings();
    } catch {
      setLocationError("Open your device settings and allow location access for VIBESWIPES.");
    }
  }

  const active = Boolean(shareId && locationShare.data?.shareId === shareId);
  const expiry = locationShare.data?.expiresAt
    ? new Date(locationShare.data.expiresAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      testID="screen-safety-center"
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.back}
          testID="button-safety-back"
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>VIBESWIPES</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Safety Center</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeading}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="shield" size={18} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              How to stay safe
            </Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              A few simple steps before you meet.
            </Text>
          </View>
        </View>
        {[
          "Never share bank details or financial information.",
          "Never send money to someone you have only met online.",
          "Meet in a public place first and tell someone you trust.",
        ].map((tip, index) => (
          <View key={tip} style={styles.tipRow}>
            <Text style={[styles.tipNumber, { color: colors.primary }]}>0{index + 1}</Text>
            <Text style={[styles.tipText, { color: colors.foreground }]}>{tip}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeading}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="users" size={18} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Emergency contacts
            </Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Save up to three people you trust. Only you can see these details.
            </Text>
          </View>
          <Text style={[styles.counter, { color: colors.mutedForeground }]}>
            {contacts.data?.length ?? 0}/3
          </Text>
        </View>

        {contacts.isLoading ? (
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Loading your contacts…
          </Text>
        ) : contacts.isError ? (
          <Pressable onPress={() => void contacts.refetch()} testID="button-retry-contacts">
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              Contacts could not load. Tap to try again.
            </Text>
          </Pressable>
        ) : (
          contacts.data?.map((contact) => (
            <View
              key={contact.id}
              style={[styles.contactRow, { borderTopColor: colors.border }]}
              testID={`contact-${contact.id}`}
            >
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: colors.foreground }]}>
                  {contact.name}
                </Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                  {contact.phone}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${contact.name}`}
                onPress={() => confirmDeleteContact(contact.id, contact.name)}
                disabled={deleteContact.isPending}
                hitSlop={8}
                testID={`button-remove-contact-${contact.id}`}
              >
                <Feather name="trash-2" size={17} color={colors.destructive} />
              </Pressable>
            </View>
          ))
        )}

        {(contacts.data?.length ?? 0) < 3 && (
          <View style={styles.contactForm}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Contact name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="next"
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
              ]}
              accessibilityLabel="Emergency contact name"
              testID="input-emergency-contact-name"
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="done"
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
              ]}
              accessibilityLabel="Emergency contact phone number"
              testID="input-emergency-contact-phone"
            />
            <Pressable
              onPress={() => void saveContact()}
              disabled={addContact.isPending || contacts.isLoading}
              style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
              testID="button-add-emergency-contact"
            >
              <Feather name="plus" size={17} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                {addContact.isPending ? "Saving…" : "Add trusted contact"}
              </Text>
            </Pressable>
            {contactError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{contactError}</Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeading}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="map-pin" size={18} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Share my location with a friend
            </Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Creates a private link that expires after one hour.
            </Text>
          </View>
        </View>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Your location updates while this Safety Center screen is open and location access is allowed. The link
          shows only your latest location and can be stopped at any time.
        </Text>

        {active ? (
          <View style={[styles.activeNotice, { backgroundColor: colors.accent }]}>
            <View style={styles.activeHeading}>
              <View style={[styles.onlineDot, { backgroundColor: "#4bd29b" }]} />
              <Text style={[styles.activeText, { color: colors.foreground }]}>
                Location link is active{expiry ? ` · expires at ${expiry}` : ""}
              </Text>
            </View>
            {shareLink ? (
              <Pressable
                onPress={() => void shareLinkWithFriend(shareLink)}
                style={[styles.secondaryButton, { backgroundColor: colors.card }]}
                testID="button-share-location-link-again"
              >
                <Feather name="share-2" size={16} color={colors.primary} />
                <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                  Share link again
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                For safety, an older link cannot be shown again. Create a new link to share it again.
              </Text>
            )}
          </View>
        ) : null}

        {locationError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{locationError}</Text>
        ) : null}
        {notice ? <Text style={[styles.noticeText, { color: colors.primary }]}>{notice}</Text> : null}

        {permission?.status === "denied" && permission.canAskAgain === false ? (
          <Pressable
            onPress={() => void openLocationSettings()}
            style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
            testID="button-open-location-settings"
          >
            <Feather name="settings" size={16} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Open location settings
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.locationActions}>
          <Pressable
            onPress={() => void startLocationShare()}
            disabled={createLocationShare.isPending}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            testID="button-start-location-share"
          >
            <Feather name={active ? "refresh-cw" : "navigation"} size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {createLocationShare.isPending
                ? "Preparing link…"
                : active
                  ? "Create a new link"
                  : "Share live location"}
            </Text>
          </Pressable>
          {active ? (
            <Pressable
              onPress={() => void stopSharing()}
              disabled={stopLocationShare.isPending}
              style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
              testID="button-stop-location-share"
            >
              <Feather name="square" size={15} color={colors.destructive} />
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                {stopLocationShare.isPending ? "Stopping…" : "Stop sharing"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeading}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="shield" size={18} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Account and community</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Manage conversations or read our expectations.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/matches" as never)}
          style={[styles.linkRow, { borderTopColor: colors.border }]}
          testID="link-safety-matches"
        >
          <Feather name="message-circle" size={17} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.foreground }]}>
            Block, report, or unmatch
          </Text>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/terms")}
          style={[styles.linkRow, { borderTopColor: colors.border }]}
          testID="link-terms"
        >
          <Feather name="book-open" size={17} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.foreground }]}>Terms of Service</Text>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/report-safety")}
          style={[styles.linkRow, { borderTopColor: colors.border }]}
          testID="link-report-safety"
        >
          <Feather name="shield" size={17} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.foreground }]}>Report a scam or safety issue</Text>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/privacy-policy")}
          style={[styles.linkRow, { borderTopColor: colors.border }]}
          testID="link-privacy-policy"
        >
          <Feather name="lock" size={17} color={colors.primary} />
          <Text style={[styles.linkText, { color: colors.foreground }]}>Privacy Policy</Text>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 36, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  back: { width: 36, height: 44, justifyContent: "center" },
  eyebrow: { fontSize: 9, letterSpacing: 1.6, fontWeight: "800", marginBottom: 4 },
  title: { fontSize: 25, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 13 },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: "800" },
  cardSub: { fontSize: 12, lineHeight: 17 },
  counter: { fontSize: 11, fontWeight: "700" },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 2 },
  tipNumber: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  contactRow: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11 },
  contactInfo: { flex: 1, gap: 3 },
  contactName: { fontSize: 13, fontWeight: "700" },
  contactForm: { gap: 9, paddingTop: 2 },
  input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  secondaryButton: { minHeight: 42, borderRadius: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryButtonText: { fontSize: 12, fontWeight: "700" },
  primaryButton: { minHeight: 47, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { fontSize: 13, fontWeight: "800" },
  helper: { fontSize: 11, lineHeight: 17 },
  errorText: { fontSize: 12, lineHeight: 18 },
  noticeText: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  activeNotice: { borderRadius: 14, padding: 12, gap: 10 },
  activeHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { flex: 1, fontSize: 12, fontWeight: "700" },
  locationActions: { gap: 9 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 11, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, paddingBottom: 2 },
  linkText: { flex: 1, fontSize: 13, fontWeight: "700" },
});

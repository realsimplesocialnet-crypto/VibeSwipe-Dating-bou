import { useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/useColors";

const SHOP_URL = "https://quickmavo.com";

export function QuickmavoShopMenuItem() {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opening = useRef(false);
  const openAfterDismiss = useRef(false);

  async function openShop() {
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(SHOP_URL);
      } else {
        try {
          await WebBrowser.openBrowserAsync(SHOP_URL, {
            toolbarColor: colors.card, controlsColor: colors.primary,
            dismissButtonStyle: "done",
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          });
        } catch {
          // Devices without an in-app browser can still use their regular browser.
          await Linking.openURL(SHOP_URL);
        }
      }
    } catch {
      setError("Couldn’t open Quickmavo Shop. Please try again.");
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }
  function confirm() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError("");
    openAfterDismiss.current = Platform.OS === "ios";
    setVisible(false);
    // iOS must dismiss our modal before presenting Safari's browser sheet.
    if (Platform.OS !== "ios") void openShop();
  }
  function cancel() {
    openAfterDismiss.current = false;
    setVisible(false);
  }

  return <>
    <Pressable testID="button-quickmavo-shop" accessibilityRole="button"
      accessibilityLabel="Quickmavo Shop" disabled={busy} accessibilityState={{ disabled: busy, busy }}
      onPress={() => setVisible(true)}
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: busy ? .5 : 1 }]}>
      <Feather name="shopping-bag" size={19} color={colors.primary}/>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>{busy ? "Opening shop…" : "Quickmavo Shop"}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Numbers, followers, eSIM &amp; airtime</Text>
      </View>
      <Feather name="external-link" size={17} color={colors.mutedForeground}/>
    </Pressable>
    {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
    <Modal visible={visible} transparent animationType="none" onRequestClose={cancel}
      onDismiss={() => {
        if (!openAfterDismiss.current) return;
        openAfterDismiss.current = false;
        void openShop();
      }}>
      <View style={styles.overlay}>
        <Pressable accessible={false} onPress={cancel}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: .85 }]}/>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.foreground }]}>Open Quickmavo Shop?</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>You are about to leave this app and go to Quickmavo.com. Continue?</Text>
          <View style={styles.actions}>
            <Pressable testID="button-quickmavo-cancel" accessibilityRole="button" onPress={cancel}
              style={[styles.button, { borderColor: colors.border }]}>
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable testID="button-quickmavo-continue" accessibilityRole="button" onPress={confirm}
              style={[styles.button, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, padding: 15, borderWidth: 1, borderRadius: 18, marginBottom: 20 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: "700" },
  subtitle: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 12, marginBottom: 16 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 420, borderWidth: 1, borderRadius: 20, padding: 24, gap: 16 },
  heading: { fontSize: 20, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 23 },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  button: { minHeight: 48, flex: 1, borderWidth: 1, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  buttonText: { fontSize: 14, fontWeight: "700" },
});

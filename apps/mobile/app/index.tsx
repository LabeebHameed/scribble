import { Link } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Constants from "expo-constants"

/**
 * Expo client scaffold — shares @workspace/core types/contracts with the Next.js API.
 * Native push and full screens land after the web MVP API stabilizes.
 */
export default function HomeScreen() {
  const apiUrl =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
    "http://localhost:3000"

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Scribble</Text>
      <Text style={styles.copy}>
        Expo shell ready. Point this client at the same TypeScript API used by
        the Next.js app ({apiUrl}). Domain types live in @workspace/core.
      </Text>
      <Link href="/capture" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Open capture (stub)</Text>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#f3faf7",
  },
  brand: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1f4f46",
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    color: "#3d5c55",
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#2f6f64",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: "#f7fffb",
    fontWeight: "600",
  },
})

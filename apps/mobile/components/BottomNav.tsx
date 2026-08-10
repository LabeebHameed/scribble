import { Pressable, StyleSheet, Text, View } from "react-native"
import { type Href, usePathname, useRouter } from "expo-router"

export function BottomNav() {
  const router = useRouter()
  const path = usePathname()
  const onToday = path === "/" || path === "/index"
  const onPlate = path === "/plate"

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => router.replace("/" as Href)}
        style={[styles.item, onToday && styles.active]}
      >
        <Text style={[styles.label, onToday && styles.labelActive]}>Today</Text>
      </Pressable>
      <Pressable
        onPress={() => router.replace("/plate" as Href)}
        style={[styles.item, onPlate && styles.active]}
      >
        <Text style={[styles.label, onPlate && styles.labelActive]}>Plate</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(31,79,70,0.12)",
  },
  item: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  active: {
    backgroundColor: "rgba(47,111,100,0.12)",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5a7a72",
  },
  labelActive: {
    color: "#1a3f38",
  },
})

import { StyleSheet, Text, TextInput, View } from "react-native"
import { useState } from "react"

export default function CaptureStub() {
  const [text, setText] = useState("")
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Capture</Text>
      <Text style={styles.hint}>
        Stub screen — wire to POST /api/captures when running against the web API.
      </Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Dump anything…"
        value={text}
        onChangeText={setText}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12, backgroundColor: "#f3faf7" },
  title: { fontSize: 28, fontWeight: "700", color: "#1f4f46" },
  hint: { color: "#3d5c55" },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#b7d0c8",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
})

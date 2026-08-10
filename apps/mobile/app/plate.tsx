import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Audio } from "expo-av"
import {
  apiBase,
  type ConverseResponse,
  type PlateItem,
} from "../lib/api"
import { BottomNav } from "../components/BottomNav"

function appendAudio(form: FormData, uri: string) {
  form.append("audio", {
    uri,
    name: "speech.m4a",
    type: "audio/m4a",
  } as unknown as Blob)
}

export default function PlateScreen() {
  const [plate, setPlate] = useState<PlateItem[]>([])
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)
  const sessionId = useRef(`expo-plate-${Date.now()}`)
  const recorder = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const startedAt = useRef(0)
  const starting = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/converse`)
      const data = (await res.json()) as { plate?: PlateItem[] }
      setPlate(data.plate || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plate")
    }
  }, [])

  useEffect(() => {
    refresh()
    return () => {
      soundRef.current?.unloadAsync().catch(() => {})
    }
  }, [refresh])

  async function completeItem(item: PlateItem) {
    setBusy(true)
    setError(null)
    try {
      if (item.kind === "reminder") {
        await fetch(`${apiBase()}/api/reminders`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, action: "complete" }),
        })
      } else if (item.kind === "task") {
        await fetch(`${apiBase()}/api/tasks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, status: "done" }),
        })
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Complete failed")
    } finally {
      setBusy(false)
    }
  }

  async function snoozeItem(item: PlateItem) {
    if (item.kind !== "reminder") return
    setBusy(true)
    try {
      await fetch(`${apiBase()}/api/reminders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "snooze", minutes: 15 }),
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snooze failed")
    } finally {
      setBusy(false)
    }
  }

  async function playReplyAudio(base64: string, mime: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync()
        soundRef.current = null
      }
      const uri = `data:${mime};base64,${base64}`
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      )
      soundRef.current = sound
    } catch {
      /* ignore */
    }
  }

  async function startRecording() {
    if (busy || recording || starting.current) return
    starting.current = true
    setError(null)
    try {
      const perm = await Audio.requestPermissionsAsync()
      if (!perm.granted) {
        setError("Microphone permission is required.")
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      const rec = new Audio.Recording()
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await rec.startAsync()
      recorder.current = rec
      startedAt.current = Date.now()
      setRecording(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record")
    } finally {
      starting.current = false
    }
  }

  async function stopAndSend() {
    if (starting.current) await new Promise((r) => setTimeout(r, 300))
    const rec = recorder.current
    if (!rec) {
      setRecording(false)
      return
    }
    setBusy(true)
    setRecording(false)
    try {
      const elapsed = Date.now() - startedAt.current
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed))
      await rec.stopAndUnloadAsync()
      const uri = rec.getURI()
      recorder.current = null
      if (!uri) throw new Error("No recording")

      const form = new FormData()
      appendAudio(form, uri)
      form.append("sessionId", sessionId.current)
      form.append("speak", "true")
      const res = await fetch(`${apiBase()}/api/converse`, {
        method: "POST",
        body: form,
      })
      const data = (await res.json()) as ConverseResponse
      if (!res.ok) throw new Error(data.error || "Converse failed")
      setReply(data.reply || "")
      if (data.plate) setPlate(data.plate)
      if (data.audioBase64 && data.audioMime) {
        await playReplyAudio(data.audioBase64, data.audioMime)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed")
    } finally {
      setBusy(false)
    }
  }

  async function onMicPress() {
    if (busy) return
    if (recording) await stopAndSend()
    else await startRecording()
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Plate</Text>
      <Text style={styles.sub}>
        Everything open · {plate.length} item{plate.length === 1 ? "" : "s"}
      </Text>

      <FlatList
        data={plate}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Plate is clear — speak something in Today.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.kind}>{item.kind}</Text>
              <Text style={styles.title}>{item.title}</Text>
            </View>
            <View style={styles.actions}>
              {item.kind === "reminder" ? (
                <Pressable onPress={() => snoozeItem(item)} style={styles.chip}>
                  <Text style={styles.chipText}>Snooze</Text>
                </Pressable>
              ) : null}
              {item.kind === "task" || item.kind === "reminder" ? (
                <Pressable onPress={() => completeItem(item)} style={styles.chipDone}>
                  <Text style={styles.chipDoneText}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />

      {reply ? <Text style={styles.reply}>{reply}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={onMicPress}
        disabled={busy}
        style={[styles.mic, recording && styles.micActive]}
      >
        {busy ? (
          <ActivityIndicator color="#f7fffb" />
        ) : (
          <Text style={styles.micText}>{recording ? "Send" : "Speak"}</Text>
        )}
      </Pressable>

      <BottomNav />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
    backgroundColor: "#eef6f2",
    gap: 10,
  },
  brand: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1a3f38",
  },
  sub: { fontSize: 15, color: "#4a6b63", marginBottom: 4 },
  list: { gap: 10, paddingBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31,79,70,0.1)",
  },
  rowText: { flex: 1, gap: 2 },
  kind: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#7a9a92",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#1a3f38" },
  actions: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  chipText: { fontSize: 13, color: "#4a6b63", fontWeight: "600" },
  chipDone: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#2f6f64",
  },
  chipDoneText: { fontSize: 13, color: "#f7fffb", fontWeight: "600" },
  empty: { color: "#5a7a72", marginTop: 24 },
  reply: { fontSize: 13, color: "#1a3f38" },
  error: { color: "#a33", fontSize: 13 },
  mic: {
    alignSelf: "center",
    minWidth: 96,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2f6f64",
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: { backgroundColor: "#c45c3e" },
  micText: { color: "#f7fffb", fontWeight: "600" },
})

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Audio } from "expo-av"
import Constants from "expo-constants"
import { StatusBar } from "expo-status-bar"

type Glance = {
  now: { title: string; start: string; end: string } | null
  needsAttention: Array<{ id: string; message: string; title: string; stage: string }>
  nextUp: Array<{ title: string; start: string; end: string; kind: string }>
}

type ConverseResponse = {
  transcript?: string
  reply?: string
  needsReply?: boolean
  sessionId?: string
  audioBase64?: string | null
  audioMime?: string | null
  glance?: Glance
  error?: string
}

function apiBase() {
  const url =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
    "http://localhost:3000"
  return url.replace(/\/$/, "")
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

/** React Native FormData expects { uri, name, type }, not a Blob. */
function appendAudio(form: FormData, uri: string) {
  const name = Platform.OS === "ios" ? "speech.m4a" : "speech.m4a"
  const type = "audio/m4a"
  form.append("audio", { uri, name, type } as unknown as Blob)
}

export default function HomeScreen() {
  const [glance, setGlance] = useState<Glance | null>(null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [heard, setHeard] = useState("")
  const [reply, setReply] = useState("")
  const [needsReply, setNeedsReply] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const sessionId = useRef(`expo-${Date.now()}`)
  const recorder = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const startedAt = useRef(0)
  const starting = useRef(false)

  const refreshGlance = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/health`)
      if (!res.ok) throw new Error(`health ${res.status}`)
      setApiOk(true)
      const g = await fetch(`${apiBase()}/api/converse`)
      const data = (await g.json()) as { glance?: Glance; error?: string }
      if (data.glance) setGlance(data.glance)
    } catch (e) {
      setApiOk(false)
      setError(
        `Cannot reach API at ${apiBase()}. ${e instanceof Error ? e.message : ""}`.trim()
      )
    }
  }, [])

  useEffect(() => {
    refreshGlance()
    ;(async () => {
      await Audio.requestPermissionsAsync()
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })
    })().catch(() => {})
    return () => {
      soundRef.current?.unloadAsync().catch(() => {})
    }
  }, [refreshGlance])

  async function playReplyAudio(base64: string, mime: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync()
        soundRef.current = null
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      })
      const uri = `data:${mime};base64,${base64}`
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      )
      soundRef.current = sound
    } catch (e) {
      console.warn("Could not play TTS audio", e)
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

      // Stop any playback so the mic can open
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {})
        await soundRef.current.unloadAsync().catch(() => {})
        soundRef.current = null
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })

      const rec = new Audio.Recording()
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await rec.startAsync()
      recorder.current = rec
      startedAt.current = Date.now()
      setRecording(true)
    } catch (e) {
      recorder.current = null
      setRecording(false)
      setError(e instanceof Error ? e.message : "Could not start recording")
    } finally {
      starting.current = false
    }
  }

  async function stopAndSend() {
    if (starting.current) {
      // Wait briefly for start to finish (tap races)
      await new Promise((r) => setTimeout(r, 300))
    }
    const rec = recorder.current
    if (!rec) {
      setRecording(false)
      return
    }

    setBusy(true)
    setRecording(false)
    try {
      const elapsed = Date.now() - startedAt.current
      if (elapsed < 600) {
        await new Promise((r) => setTimeout(r, 600 - elapsed))
      }

      const status = await rec.getStatusAsync()
      if (!status.isRecording && !status.canRecord) {
        throw new Error("Recording did not start — try again and hold a bit longer.")
      }

      await rec.stopAndUnloadAsync()
      const uri = rec.getURI()
      recorder.current = null
      if (!uri) throw new Error("No recording file was created.")

      const form = new FormData()
      appendAudio(form, uri)
      form.append("sessionId", sessionId.current)
      form.append("speak", "true")

      const res = await fetch(`${apiBase()}/api/converse`, {
        method: "POST",
        body: form,
        // Do not set Content-Type — RN sets multipart boundary
      })

      const text = await res.text()
      let data: ConverseResponse
      try {
        data = JSON.parse(text) as ConverseResponse
      } catch {
        throw new Error(`Bad API response (${res.status}): ${text.slice(0, 120)}`)
      }
      if (!res.ok) throw new Error(data.error || `Converse failed (${res.status})`)

      setHeard(data.transcript || "")
      setReply(data.reply || "")
      setNeedsReply(Boolean(data.needsReply))
      if (data.glance) setGlance(data.glance)
      if (data.audioBase64 && data.audioMime) {
        await playReplyAudio(data.audioBase64, data.audioMime)
      }
      setApiOk(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      // Surface the classic RN file-upload failure clearly
      if (/network request failed/i.test(msg)) {
        setError(
          `Network request failed talking to ${apiBase()}. Check apiUrl and that the phone can reach Vercel.`
        )
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        })
      } catch {
        /* ignore */
      }
    }
  }

  async function onMicPress() {
    if (busy) return
    if (recording) {
      await stopAndSend()
    } else {
      await startRecording()
    }
  }

  const attention = glance?.needsAttention?.[0]
  const next = glance?.nextUp?.[0]

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>Scribble</Text>
      <Text style={styles.sub}>
        {needsReply
          ? "Listening for your answer…"
          : recording
            ? "Recording — tap again when done"
            : "Tap to speak. I’ll ask if I need more."}
      </Text>
      <Text style={styles.apiHint}>
        API: {apiOk === false ? "unreachable · " : apiOk ? "ok · " : ""}
        {apiBase()}
      </Text>

      <View style={styles.glance}>
        {attention ? (
          <View style={styles.cardAttention}>
            <Text style={styles.cardLabel}>Needs attention</Text>
            <Text style={styles.cardTitle}>{attention.message}</Text>
          </View>
        ) : null}
        {glance?.now ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Now</Text>
            <Text style={styles.cardTitle}>{glance.now.title}</Text>
            <Text style={styles.cardMeta}>
              {formatTime(glance.now.start)} – {formatTime(glance.now.end)}
            </Text>
          </View>
        ) : null}
        {next ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Next up</Text>
            <Text style={styles.cardTitle}>{next.title}</Text>
            <Text style={styles.cardMeta}>{formatTime(next.start)}</Text>
          </View>
        ) : null}
        {!attention && !glance?.now && !next ? (
          <Text style={styles.empty}>Nothing on your plate yet — tap and speak.</Text>
        ) : null}
      </View>

      <Pressable
        onPress={onMicPress}
        disabled={busy}
        style={[
          styles.mic,
          recording && styles.micActive,
          busy && styles.micBusy,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#f7fffb" size="large" />
        ) : (
          <Text style={styles.micText}>
            {recording ? "Tap to send" : "Tap to speak"}
          </Text>
        )}
      </Pressable>

      {(heard || reply) && (
        <View style={styles.mirror}>
          {heard ? <Text style={styles.heard}>You: {heard}</Text> : null}
          {reply ? <Text style={styles.reply}>Scribble: {reply}</Text> : null}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    backgroundColor: "#eef6f2",
    gap: 12,
  },
  brand: {
    fontSize: 40,
    fontWeight: "700",
    color: "#1a3f38",
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 16,
    color: "#4a6b63",
  },
  apiHint: {
    fontSize: 11,
    color: "#7a9a92",
    marginBottom: 4,
  },
  glance: { gap: 10, flexGrow: 1 },
  card: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(31,79,70,0.12)",
  },
  cardAttention: {
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(180, 120, 20, 0.35)",
  },
  cardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#5a7a72",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1a3f38" },
  cardMeta: { fontSize: 13, color: "#5a7a72", marginTop: 2 },
  empty: { color: "#5a7a72", fontSize: 15 },
  mic: {
    alignSelf: "center",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#2f6f64",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a3f38",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  micActive: { backgroundColor: "#c45c3e", transform: [{ scale: 1.04 }] },
  micBusy: { opacity: 0.7 },
  micText: { color: "#f7fffb", fontSize: 18, fontWeight: "600", textAlign: "center" },
  mirror: { gap: 6, minHeight: 48 },
  heard: { color: "#4a6b63", fontSize: 14 },
  reply: { color: "#1a3f38", fontSize: 15, fontWeight: "500" },
  error: { color: "#a33", fontSize: 13 },
})

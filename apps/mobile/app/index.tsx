import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
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
  return (
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
    "http://localhost:3000"
  )
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

export default function HomeScreen() {
  const [glance, setGlance] = useState<Glance | null>(null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [heard, setHeard] = useState("")
  const [reply, setReply] = useState("")
  const [needsReply, setNeedsReply] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionId = useRef(`expo-${Date.now()}`)
  const recorder = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)

  const refreshGlance = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/converse`)
      const data = (await res.json()) as { glance?: Glance }
      if (data.glance) setGlance(data.glance)
    } catch {
      /* offline / API down */
    }
  }, [])

  useEffect(() => {
    refreshGlance()
    Audio.requestPermissionsAsync().catch(() => {})
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    }).catch(() => {})
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
      const uri = `data:${mime};base64,${base64}`
      const { sound } = await Audio.Sound.createAsync({ uri })
      soundRef.current = sound
      await sound.playAsync()
    } catch (e) {
      console.warn("Could not play TTS audio", e)
    }
  }

  async function startRecording() {
    if (busy || recording) return
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
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recorder.current = rec
      setRecording(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording")
    }
  }

  async function stopAndSend() {
    if (!recorder.current) {
      setRecording(false)
      return
    }
    setRecording(false)
    setBusy(true)
    try {
      await recorder.current.stopAndUnloadAsync()
      const uri = recorder.current.getURI()
      recorder.current = null
      if (!uri) throw new Error("No recording captured")

      const fileRes = await fetch(uri)
      const blob = await fileRes.blob()
      const form = new FormData()
      form.append("audio", blob as unknown as Blob, "speech.m4a")
      form.append("sessionId", sessionId.current)
      form.append("speak", "true")

      const res = await fetch(`${apiBase()}/api/converse`, {
        method: "POST",
        body: form,
      })
      const data = (await res.json()) as ConverseResponse
      if (!res.ok) throw new Error(data.error || "Converse failed")

      setHeard(data.transcript || "")
      setReply(data.reply || "")
      setNeedsReply(Boolean(data.needsReply))
      if (data.glance) setGlance(data.glance)
      if (data.audioBase64 && data.audioMime) {
        await playReplyAudio(data.audioBase64, data.audioMime)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  const attention = glance?.needsAttention?.[0]
  const next = glance?.nextUp?.[0]

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>Scribble</Text>
      <Text style={styles.sub}>
        {needsReply ? "Listening for your answer…" : "Speak. I’ll ask if I need more."}
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
        onPressIn={startRecording}
        onPressOut={stopAndSend}
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
          <Text style={styles.micText}>{recording ? "Listening…" : "Hold to speak"}</Text>
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
    gap: 16,
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
    marginBottom: 8,
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
  micText: { color: "#f7fffb", fontSize: 18, fontWeight: "600" },
  mirror: { gap: 6, minHeight: 48 },
  heard: { color: "#4a6b63", fontSize: 14 },
  reply: { color: "#1a3f38", fontSize: 15, fontWeight: "500" },
  error: { color: "#a33", fontSize: 13 },
})

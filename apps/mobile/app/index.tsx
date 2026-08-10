import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Audio } from "expo-av"
import {
  apiBase,
  type AssistantState,
  type ConverseResponse,
  type Glance,
  formatTime,
} from "../lib/api"
import { BottomNav } from "../components/BottomNav"

function appendAudio(form: FormData, uri: string) {
  form.append("audio", {
    uri,
    name: "speech.m4a",
    type: "audio/m4a",
  } as unknown as Blob)
}

export default function TodayScreen() {
  const [glance, setGlance] = useState<Glance | null>(null)
  const [assistant, setAssistant] = useState<AssistantState | null>(null)
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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/health`)
      if (!res.ok) throw new Error(`health ${res.status}`)
      setApiOk(true)
      const g = await fetch(`${apiBase()}/api/converse`)
      const data = (await g.json()) as {
        glance?: Glance
        assistant?: AssistantState
        error?: string
      }
      if (data.glance) setGlance(data.glance)
      if (data.assistant) setAssistant(data.assistant)
    } catch (e) {
      setApiOk(false)
      setError(
        `Cannot reach API at ${apiBase()}. ${e instanceof Error ? e.message : ""}`.trim()
      )
    }
  }, [])

  useEffect(() => {
    refresh()
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
  }, [refresh])

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
      const status = await rec.getStatusAsync()
      if (!status.isRecording && !status.canRecord) {
        throw new Error("Recording did not start — try again.")
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
      if (data.assistant) setAssistant(data.assistant)
      if (data.audioBase64 && data.audioMime) {
        await playReplyAudio(data.audioBase64, data.audioMime)
      }
      setApiOk(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
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
    if (recording) await stopAndSend()
    else await startRecording()
  }

  const next = assistant?.nextAction
  const timeline = glance?.nextUp?.slice(0, 3) || []

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Scribble</Text>
      <Text style={styles.sub}>
        {needsReply
          ? "Listening for your answer…"
          : recording
            ? "Recording — tap again when done"
            : "Today · tap to speak"}
      </Text>
      <Text style={styles.apiHint}>
        API: {apiOk === false ? "unreachable · " : apiOk ? "ok · " : ""}
        {apiBase()}
      </Text>

      <View style={styles.body}>
        {next && next.source !== "none" ? (
          <View style={styles.nextCard}>
            <Text style={styles.cardLabel}>Next</Text>
            <Text style={styles.nextTitle}>{next.title}</Text>
            <Text style={styles.nextWhy}>{next.reason}</Text>
          </View>
        ) : (
          <Text style={styles.empty}>Nothing queued — speak a task or reminder.</Text>
        )}

        {reply ? (
          <View style={styles.briefing}>
            <Text style={styles.cardLabel}>Briefing</Text>
            <Text style={styles.briefingText}>{reply}</Text>
          </View>
        ) : null}

        {timeline.length > 0 ? (
          <View style={styles.timeline}>
            <Text style={styles.cardLabel}>Timeline</Text>
            {timeline.map((b, i) => (
              <Text key={`${b.title}-${i}`} style={styles.timelineRow}>
                {formatTime(b.start)} · {b.title}
              </Text>
            ))}
          </View>
        ) : null}

        {glance?.now ? (
          <Text style={styles.nowLine}>
            Now: {glance.now.title} ({formatTime(glance.now.start)}–
            {formatTime(glance.now.end)})
          </Text>
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

      {(heard || error) && (
        <View style={styles.mirror}>
          {heard ? <Text style={styles.heard}>You: {heard}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}

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
    fontSize: 40,
    fontWeight: "700",
    color: "#1a3f38",
    letterSpacing: -0.5,
  },
  sub: { fontSize: 16, color: "#4a6b63" },
  apiHint: { fontSize: 11, color: "#7a9a92", marginBottom: 4 },
  body: { gap: 12, flexGrow: 1 },
  nextCard: {
    backgroundColor: "rgba(47,111,100,0.14)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(31,79,70,0.18)",
  },
  cardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#5a7a72",
    marginBottom: 4,
  },
  nextTitle: { fontSize: 22, fontWeight: "700", color: "#1a3f38" },
  nextWhy: { fontSize: 14, color: "#4a6b63", marginTop: 4 },
  briefing: { gap: 4 },
  briefingText: { fontSize: 16, lineHeight: 22, color: "#1a3f38", fontWeight: "500" },
  timeline: { gap: 4 },
  timelineRow: { fontSize: 14, color: "#4a6b63" },
  nowLine: { fontSize: 13, color: "#5a7a72" },
  empty: { color: "#5a7a72", fontSize: 15 },
  mic: {
    alignSelf: "center",
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: "#2f6f64",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a3f38",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginVertical: 8,
  },
  micActive: { backgroundColor: "#c45c3e", transform: [{ scale: 1.04 }] },
  micBusy: { opacity: 0.7 },
  micText: {
    color: "#f7fffb",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  mirror: { gap: 4, minHeight: 20 },
  heard: { color: "#4a6b63", fontSize: 13 },
  error: { color: "#a33", fontSize: 13 },
})

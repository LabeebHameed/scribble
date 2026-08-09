export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 480 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Scribble API</h1>
      <p style={{ color: "#456", lineHeight: 1.5 }}>
        The product experience is the Expo voice app. This deployment hosts the
        API (<code>/api/converse</code>, <code>/api/health</code>, setup).
      </p>
    </main>
  )
}

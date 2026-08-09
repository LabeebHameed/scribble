import Link from "next/link"
import { Fraunces, Source_Sans_3 } from "next/font/google"
import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"
import { AppNav } from "@/components/layout/app-nav"

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
})

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata = {
  title: "Scribble",
  description: "ADHD life operating system — capture, plan, remember.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(display.variable, sans.variable, "font-sans antialiased")}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <ThemeProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-3xl">
            <header className="flex items-center justify-between px-4 pb-2 pt-5">
              <Link href="/today" className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
                Scribble
              </Link>
              <span className="text-xs text-muted-foreground">life OS</span>
            </header>
            <main className="flex-1 px-4 pb-24 pt-2">{children}</main>
            <AppNav />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

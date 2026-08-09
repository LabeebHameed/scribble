"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  HomeIcon,
  MessageSquareIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

const items = [
  { href: "/today", label: "Today", icon: HomeIcon },
  { href: "/capture", label: "Capture", icon: MessageSquareIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/memory", label: "Memory", icon: SearchIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

export function AppNav() {
  const pathname = usePathname()
  if (pathname === "/") return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-2 py-2 md:max-w-3xl">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

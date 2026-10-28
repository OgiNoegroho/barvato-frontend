import type { NavItem } from "../types"

export const navItems: NavItem[] = [
  { label: "Overview", icon: "grid" },
  { label: "Operations", icon: "calendar" },
  { label: "Appointments", icon: "book" },
  { label: "Team", icon: "scissors" },
  { label: "Money", icon: "wallet" },
  { label: "Settings", icon: "settings" },
]

export const teamMembers: string[][] = [
  ["JR", "Julian Ross", "Senior barber", "6 today", "$524"],
  ["MS", "Mateo Silva", "Barber", "5 today", "$438"],
  ["DC", "Darius Cole", "Master barber", "4 today", "$396"],
  ["AN", "Avery Nash", "Barber", "Off today", "—"],
]

export const barbersList = ["Julian Ross", "Mateo Silva", "Darius Cole"]

import type { QueueItem, OpsQueueItem } from "../types"

export const queueSeed: QueueItem[] = [
  {
    id: 1,
    initials: "JR",
    name: "Jon Reed",
    service: "Classic cut",
    wait: "8 min",
    barber: "Next available",
    state: "waiting",
  },
  {
    id: 2,
    initials: "AM",
    name: "Alex Morgan",
    service: "Cut + beard",
    wait: "19 min",
    barber: "Mateo",
    state: "waiting",
  },
  {
    id: 3,
    initials: "LB",
    name: "Luis Bennett",
    service: "Beard sculpt",
    wait: "26 min",
    barber: "Julian",
    state: "waiting",
  },
]

export const initialOpsQueueItems: OpsQueueItem[] = [
  { ...queueSeed[0], arrival: "9:18 AM", state: "waiting" },
  { ...queueSeed[1], arrival: "9:07 AM", assigned: "Mateo", state: "waiting" },
  { ...queueSeed[2], arrival: "8:56 AM", assigned: "Julian", state: "waiting" },
  {
    id: 4,
    initials: "DM",
    name: "Dylan Moore",
    service: "Skin fade",
    wait: "12 min left",
    barber: "Darius",
    assigned: "Darius",
    arrival: "8:40 AM",
    state: "service",
  },
  {
    id: 5,
    initials: "RK",
    name: "Ryan King",
    service: "Beard trim",
    wait: "Done 9:12",
    barber: "Julian",
    assigned: "Julian",
    arrival: "8:25 AM",
    state: "completed",
  },
]

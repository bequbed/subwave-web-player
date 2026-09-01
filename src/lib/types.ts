// Types for the SUB/WAVE public HTTP surface. This is a pragmatic subset of the
// controller's real response shapes — enough to build a full player, with the
// fields a redesigner is likely to reach for. Everything the controller may
// omit (untagged tracks, offline stream) is optional.

export type StationLocale = 'en-GB' | 'en-US';

/** A track currently airing. `subsonic_id` is present for library tracks and
 *  drives cover-art artwork via the `/cover/:id` proxy. Jingles have none. */
export interface NowPlayingTrack {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  duration?: number;
  subsonic_id?: string;
  // Acoustic-analysis / tag data merged in by the controller. All optional.
  genre?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  moods?: string[];
  energy?: 'low' | 'medium' | 'high' | null;
}

export interface WeatherContext {
  condition?: string;
  temp?: number;
  location?: string;
}
export interface TimeContext {
  /** Fixed day-period label from the controller: 'early-morning', 'morning',
   *  'midday', 'afternoon', 'drive-time', 'evening', 'late-evening',
   *  'after-hours'. */
  period?: string;
  /** Mood word for the period (settings.moodSchedule): 'focus', 'driving', … */
  mood?: string;
  show?: string;
  vibe?: string;
}
export interface FestivalContext {
  name?: string;
  mood?: string;
}

export interface Persona {
  id?: string;
  name?: string;
  /** Full public URL to the persona portrait (or a transparent placeholder). */
  avatar?: string;
}

export interface ActiveShow {
  name?: string;
  persona?: Persona | null;
  /** Guest co-hosts (same shape as persona). Empty/absent = solo show. */
  guests?: Persona[];
}

export interface StationContext {
  time?: TimeContext;
  weather?: WeatherContext;
  festival?: FestivalContext;
  dominantMood?: string;
  activeShow?: ActiveShow | null;
}

export interface ListenerCount {
  current?: number;
  peak?: number;
  total?: number;
}

/** `GET /now-playing`. */
export interface NowPlayingResponse {
  nowPlaying: NowPlayingTrack | null;
  context: StationContext | null;
  dj?: {
    name?: string;
    tagline?: string;
    avatar?: string;
    station?: string;
  };
  activeShow?: ActiveShow | null;
  listeners?: ListenerCount | number;
  streamOnline?: boolean;
  streamBitrate?: number | null;
  /** Cumulative since-boot LLM token total — the token ticker. */
  llmTokens?: number | null;
  timezone?: string;
  locale?: StationLocale;
}

/** A queue / history entry from `GET /state`. */
export interface QueueEntry {
  title?: string;
  artist?: string;
  album?: string;
  subsonic_id?: string;
  requestedBy?: string;
  /** ISO timestamp, present on history entries. */
  t?: string;
}

/** A DJ-log line from `GET /state`. */
export interface DjLogEntry {
  t?: string;
  level?: string;
  message?: string;
}

/** `GET /state`. */
export interface StationState {
  upcoming?: QueueEntry[];
  history?: QueueEntry[];
  djLog?: DjLogEntry[];
  needsSetup?: boolean;
  timezone?: string;
  locale?: StationLocale;
}

/** A single turn in the live DJ session (`GET /session`). */
export interface SessionMessage {
  t?: number;
  role?: string;
  /** e.g. 'intro' | 'link' | 'request' | 'station-id' | 'weather' | … */
  kind?: string;
  text?: string;
  meta?: Record<string, unknown>;
}

/** `GET /session`. */
export interface SessionPayload {
  session: {
    id: string;
    kind?: string;
    startedAt?: number;
    show?: string | null;
  } | null;
  messages: SessionMessage[];
}

/** `GET /schedule`. */
export interface SchedulePersona {
  id: string;
  name: string;
  avatar: string;
}
export interface ScheduleShow {
  id: string;
  name: string;
  topic?: string;
  mood?: string;
  moods?: string[];
  personaId: string;
}
/** 7 keys (Sun=0..Sat=6), each a 24-slot array of showId|null. */
export type ScheduleGrid = Record<number, Array<string | null>>;
export interface SchedulePayload {
  personas: SchedulePersona[];
  shows: ScheduleShow[];
  schedule: ScheduleGrid;
  timezone?: string | null;
  locale?: StationLocale;
}

export type RequestStatus = 'pending' | 'resolved' | 'failed' | 'unknown';

export interface RequestTrack {
  title?: string;
  artist?: string;
  album?: string;
  subsonic_id?: string;
}

/** `POST /request` and `GET /request/:id`. */
export interface RequestResult {
  success: boolean;
  pending?: boolean;
  status?: RequestStatus;
  /** Present on a successful POST — the id to poll `/request/:id` with. */
  requestId?: string;
  track?: RequestTrack | null;
  message?: string;
  /** A conversational line from the DJ acknowledging the request. */
  reply?: string;
}

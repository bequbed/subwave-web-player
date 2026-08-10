// Minimal ambient types for the Google Cast Web Sender SDK
// (loaded from https://www.gstatic.com/cv/js/sender/v1/cast_sender.js).
// The SDK installs `window.cast` (the CAF framework) plus the legacy
// `chrome.cast` media model used by loadMedia(). Only the surface this player
// uses is declared here; the full SDK is typed upstream in the published
// `@types/chromecast-caf-sender` package if a fork needs more. `window.chrome`
// is left alone (lib.dom owns it) — useCast reaches the media classes through
// an explicit cast of its type.

export {};

declare global {
  interface Window {
    /** Set by index.html's __onGCastApiAvailable bridge (null on unsupported browsers). */
    __castApiAvailable?: boolean;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    /** Installed by cast_sender.js once loaded. */
    cast?: {
      framework: CastFramework;
    };
  }

  /** CAF (Cast Application Framework) — the modern sender API surface. */
  interface CastFramework {
    CastContext: {
      getInstance(): CastContext;
    };
    CastContextEventType: {
      CAST_STATE_CHANGED: string;
      SESSION_STATE_CHANGED: string;
    };
    CastState: {
      NO_DEVICES_AVAILABLE: string;
      NOT_CONNECTED: string;
      CONNECTING: string;
      CONNECTED: string;
    };
  }

  interface CastContext {
    setOptions(options: {
      receiverApplicationId: string;
      autoJoinPolicy: string;
    }): void;
    getCastState(): string;
    getCurrentSession(): CastSession | null;
    /** Opens the cast selection UI. Resolves once the session is established
     *  (or the user dismisses it) with an error code, NOT a session — the
     *  session is read from getCurrentSession() afterwards. */
    requestSession(): Promise<string | null>;
    /** End the active session; true = also stop the app on the receiver. */
    endCurrentSession(stopCasting: boolean): void;
    addEventListener(type: string, handler: (event: CastEvent) => void): void;
    removeEventListener(type: string, handler: (event: CastEvent) => void): void;
  }

  interface CastEvent {
    castState: string;
  }

  interface CastSession {
    loadMedia(request: CastLoadRequest): Promise<string | null>;
    getSessionObj(): { receiver: { friendlyName: string } };
    /** Live media status on the receiver, or null before a load is in flight. */
    getMediaSession(): CastMediaSession | null;
  }

  interface CastMediaSession {
    /** 'IDLE' | 'BUFFERING' | 'PAUSED' | 'PLAYING' | 'ENDED' */
    playerState: string;
  }

  /** Legacy `chrome.cast` model — the classes loadMedia() consumes. */
  interface CastMediaNamespace {
    AutoJoinPolicy: { ORIGIN_SCOPED: string };
    media: {
      Image: new (url: string) => CastImage;
      MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
      StreamType: { LIVE: string; BUFFERED: string };
      MusicTrackMediaMetadata: new () => CastMusicTrackMetadata;
      LoadRequest: new (media: CastMediaInfo) => CastLoadRequest;
    };
  }

  interface CastImage {
    url: string;
  }

  interface CastMediaInfo {
    contentId: string;
    contentType: string;
    streamType: string;
    metadata: CastMusicTrackMetadata | null;
  }

  interface CastMusicTrackMetadata {
    metadataType: number;
    title: string;
    artist: string;
    albumName: string;
    images: CastImage[];
  }

  interface CastLoadRequest {
    media: CastMediaInfo;
  }
}

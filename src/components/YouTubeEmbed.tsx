import { useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { ExternalLink, FastForward, Maximize2, Minimize2, Pause, Play, Rewind, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { NATIVE_EMBED_LAYOUT_EVENT, visibleNativeEmbedBounds } from "../lib/native";

interface YouTubeVideo {
  id: string;
  start: number;
}

function timeInSeconds(value: string | null) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function parseYouTubeUrl(source: string): YouTubeVideo | null {
  const candidate = source.trim().split(/\s+/)[0];
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
      else if (/^\/(?:embed|shorts|live)\//.test(url.pathname)) id = url.pathname.split("/")[2] ?? "";
    }
    if (!/^[\w-]{11}$/.test(id)) return null;
    return { id, start: timeInSeconds(url.searchParams.get("start") ?? url.searchParams.get("t")) };
  } catch {
    return null;
  }
}

export function YouTubeEmbed({ source }: { source: string }) {
  const video = useMemo(() => parseYouTubeUrl(source), [source]);
  const frame = useRef<HTMLIFrameElement>(null);
  const frameHost = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const nativeLabel = useRef<string | null>(null);
  const currentTime = useRef(video?.start ?? 0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fillSlide, setFillSlide] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [nativeError, setNativeError] = useState("");
  const nativePlayer = isTauri() && (/Macintosh|Mac OS X/i.test(navigator.userAgent) || /Mac/i.test(navigator.platform));

  const command = (func: string, args: unknown[] = []) => {
    if (nativePlayer && nativeLabel.current) {
      const value = typeof args[0] === "number" ? args[0] : undefined;
      invoke("control_youtube_embed", { label: nativeLabel.current, action: func, value }).catch(() => undefined);
      return;
    }
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube-nocookie.com");
  };
  const togglePlayback = () => {
    command(playing ? "pauseVideo" : "playVideo");
    setPlaying((value) => !value);
  };
  const toggleMute = () => {
    command(muted ? "unMute" : "mute");
    setMuted((value) => !value);
  };
  const seekRelative = (seconds: number) => {
    if (nativePlayer) command("seekBy", [seconds]);
    else command("seekTo", [Math.max(0, currentTime.current + seconds), true]);
  };

  useEffect(() => {
    if (!nativePlayer || !video || !frameHost.current) return;
    const label = `youtube-${video.id}-${crypto.randomUUID().replace(/[^a-z\d]/gi, "").slice(0, 20)}`;
    nativeLabel.current = label;
    let disposed = false;
    let ready = false;
    const bounds = () => frameHost.current ? visibleNativeEmbedBounds(frameHost.current) : null;
    const syncBounds = () => {
      const next = bounds();
      if (!ready || !next) return;
      invoke("position_youtube_embed", { label, bounds: next }).catch(() => undefined);
    };
    const initialBounds = bounds();
    if (!initialBounds) return;
    invoke("create_youtube_embed", { label, videoId: video.id, start: video.start, bounds: initialBounds })
      .then(() => {
        ready = true;
        if (disposed) invoke("close_youtube_embed", { label }).catch(() => undefined);
        else syncBounds();
      })
      .catch((error) => {
        if (!disposed) setNativeError(error instanceof Error ? error.message : String(error));
      });
    const observer = new ResizeObserver(syncBounds);
    observer.observe(frameHost.current);
    window.addEventListener("resize", syncBounds);
    window.addEventListener("scroll", syncBounds, true);
    window.addEventListener(NATIVE_EMBED_LAYOUT_EVENT, syncBounds);
    return () => {
      disposed = true;
      ready = false;
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("scroll", syncBounds, true);
      window.removeEventListener(NATIVE_EMBED_LAYOUT_EVENT, syncBounds);
      if (nativeLabel.current === label) nativeLabel.current = null;
      invoke("close_youtube_embed", { label }).catch(() => undefined);
    };
  }, [fillSlide, fullscreen, nativePlayer, video?.id, video?.start]);

  useEffect(() => {
    if (!nativePlayer || !nativeLabel.current) return;
    const animationFrame = requestAnimationFrame(() => {
      const rect = frameHost.current ? visibleNativeEmbedBounds(frameHost.current) : null;
      if (!rect || !nativeLabel.current) return;
      invoke("position_youtube_embed", {
        label: nativeLabel.current,
        bounds: rect,
      }).catch(() => undefined);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [fillSlide, fullscreen, nativePlayer]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com" && event.origin !== "https://www.youtube.com") return;
      let data: { event?: string; info?: { playerState?: number; currentTime?: number; muted?: boolean } } | null = null;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.event !== "infoDelivery" || !data.info) return;
      if (typeof data.info.playerState === "number") setPlaying(data.info.playerState === 1);
      if (typeof data.info.muted === "boolean") setMuted(data.info.muted);
      if (typeof data.info.currentTime === "number") currentTime.current = data.info.currentTime;
    };
    const onFullscreen = () => setFullscreen(document.fullscreenElement === container.current);
    window.addEventListener("message", onMessage);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  if (!video) return <div className="youtube-error">Use a valid YouTube, Shorts, or youtu.be URL.</div>;
  const watchUrl = `https://www.youtube.com/watch?v=${video.id}${video.start ? `&t=${video.start}s` : ""}`;
  const browserOrigin = /^https?:$/.test(window.location.protocol) ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
  const embedUrl = `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&playsinline=1&rel=0${browserOrigin}${video.start ? `&start=${video.start}` : ""}`;
  const setSeekOffset = (seconds: number) => {
    seekRelative(seconds);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement === container.current) await document.exitFullscreen();
    else await container.current?.requestFullscreen();
  };

  return <div ref={container} className={`youtube-embed${fillSlide ? " youtube-fill-slide" : ""}`}>
    <div ref={frameHost} className="youtube-frame">
      <img className="youtube-poster" src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="YouTube video preview" />
      {!nativePlayer && <iframe ref={frame} src={embedUrl} title="Embedded YouTube video" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: video.id }), "https://www.youtube-nocookie.com")} />}
      {nativeError && <div className="youtube-native-error"><b>Could not load the embedded player</b><small>{nativeError}</small><a href={watchUrl} target="_blank" rel="noreferrer">Watch on YouTube</a></div>}
    </div>
    <div className="youtube-controls" role="toolbar" aria-label="Video controls" onPointerDown={(event) => event.stopPropagation()}>
      {!nativePlayer && <>
        <button type="button" onClick={() => { command("seekTo", [video.start, true]); setPlaying(false); command("pauseVideo"); }} title="Restart video"><RotateCcw /></button>
        <button type="button" onClick={() => setSeekOffset(-10)} title="Back 10 seconds"><Rewind /></button>
        <button type="button" className="youtube-play" onClick={togglePlayback} title={playing ? "Pause video" : "Play video"}>{playing ? <Pause /> : <Play />}</button>
        <button type="button" onClick={() => setSeekOffset(10)} title="Forward 10 seconds"><FastForward /></button>
        <button type="button" onClick={toggleMute} title={muted ? "Unmute video" : "Mute video"}>{muted ? <VolumeX /> : <Volume2 />}</button>
      </>}
      {nativePlayer && <small>Playback controls are inside the video</small>}
      <span />
      <a href={watchUrl} target="_blank" rel="noreferrer" title="Open on YouTube"><ExternalLink /></a>
      <button type="button" onClick={() => setFillSlide((value) => !value)} title={fillSlide ? "Restore video size" : "Fill slide"}>{fillSlide ? <Minimize2 /> : <Maximize2 />}<b>{fillSlide ? "Restore" : "Fill slide"}</b></button>
      <button type="button" onClick={() => toggleFullscreen().catch(() => undefined)} title={fullscreen ? "Exit fullscreen" : "Open fullscreen"}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</button>
    </div>
  </div>;
}

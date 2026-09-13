import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FastForward, Maximize2, Minimize2, Pause, Play, Rewind, RotateCcw, Volume2, VolumeX } from "lucide-react";

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
  const container = useRef<HTMLDivElement>(null);
  const currentTime = useRef(video?.start ?? 0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fillSlide, setFillSlide] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const command = (func: string, args: unknown[] = []) => {
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
    command("seekTo", [Math.max(0, currentTime.current + seconds), true]);
  };

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
  const embedUrl = `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&playsinline=1&rel=0${video.start ? `&start=${video.start}` : ""}`;
  const setSeekOffset = (seconds: number) => {
    seekRelative(seconds);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement === container.current) await document.exitFullscreen();
    else await container.current?.requestFullscreen();
  };

  return <div ref={container} className={`youtube-embed${fillSlide ? " youtube-fill-slide" : ""}`}>
    <div className="youtube-frame">
      <img className="youtube-poster" src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="YouTube video preview" />
      <iframe ref={frame} src={embedUrl} title="Embedded YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: video.id }), "https://www.youtube-nocookie.com")} />
    </div>
    <div className="youtube-controls" role="toolbar" aria-label="Video controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => { command("seekTo", [video.start, true]); setPlaying(false); command("pauseVideo"); }} title="Restart video"><RotateCcw /></button>
      <button type="button" onClick={() => setSeekOffset(-10)} title="Back 10 seconds"><Rewind /></button>
      <button type="button" className="youtube-play" onClick={togglePlayback} title={playing ? "Pause video" : "Play video"}>{playing ? <Pause /> : <Play />}</button>
      <button type="button" onClick={() => setSeekOffset(10)} title="Forward 10 seconds"><FastForward /></button>
      <button type="button" onClick={toggleMute} title={muted ? "Unmute video" : "Mute video"}>{muted ? <VolumeX /> : <Volume2 />}</button>
      <span />
      <a href={watchUrl} target="_blank" rel="noreferrer" title="Open on YouTube"><ExternalLink /></a>
      <button type="button" onClick={() => setFillSlide((value) => !value)} title={fillSlide ? "Restore video size" : "Fill slide"}>{fillSlide ? <Minimize2 /> : <Maximize2 />}<b>{fillSlide ? "Restore" : "Fill slide"}</b></button>
      <button type="button" onClick={() => toggleFullscreen().catch(() => undefined)} title={fullscreen ? "Exit fullscreen" : "Open fullscreen"}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</button>
    </div>
  </div>;
}

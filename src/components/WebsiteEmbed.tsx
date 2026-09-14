import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { ExternalLink, Maximize2, Minimize2, MonitorSmartphone, RefreshCw } from "lucide-react";

type ViewportMode = "auto" | "desktop" | "tablet" | "mobile";

const viewportWidths: Record<ViewportMode, number | null> = {
  auto: null,
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

function initialViewportMode(): ViewportMode {
  const saved = localStorage.getItem("presenta:website-viewport");
  return saved === "desktop" || saved === "tablet" || saved === "mobile" ? saved : "auto";
}

function viewportZoom(width: number, mode: ViewportMode) {
  const target = viewportWidths[mode];
  return target ? Math.max(0.1, Math.min(1, width / target)) : 1;
}

interface WebsiteConfig {
  url: URL | null;
  style: CSSProperties;
  customHeight: boolean;
  error: string;
}

function parseDimension(value: string, axis: "width" | "height") {
  const percentage = value.match(/^(\d+(?:\.\d+)?)%$/);
  if (percentage) {
    const amount = Number(percentage[1]);
    return amount > 0 && amount <= 100 ? `${amount}%` : null;
  }
  const pixels = value.match(/^(\d+(?:\.\d+)?)px$/i);
  if (pixels) {
    const amount = Number(pixels[1]);
    const maximum = axis === "width" ? 2000 : 1200;
    return amount > 0 && amount <= maximum ? `${amount}px` : null;
  }
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const amount = Number(value);
    const reference = axis === "width" ? 1600 : 900;
    return amount > 0 && amount <= reference ? `${Number(((amount / reference) * 100).toFixed(3))}%` : null;
  }
  return null;
}

function parseWebsiteConfig(source: string): WebsiteConfig {
  const [candidate = "", ...settings] = source.trim().split(/\s+/);
  let url: URL | null = null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") url = parsed;
  } catch {
    // The component returns a useful validation message below.
  }
  if (!url) return { url: null, style: {}, customHeight: false, error: "Use a complete http:// or https:// website URL." };

  const style: CSSProperties = {};
  let customHeight = false;
  for (const setting of settings) {
    const match = setting.match(/^(width|height)=(.+)$/i);
    if (!match) return { url, style: {}, customHeight: false, error: `Unknown website option: ${setting}` };
    const property = match[1].toLowerCase() as "width" | "height";
    const dimension = parseDimension(match[2], property);
    if (!dimension) return { url, style: {}, customHeight: false, error: `Invalid website ${property}: ${match[2]}` };
    style[property] = dimension;
    if (property === "height") customHeight = true;
  }
  return { url, style, customHeight, error: "" };
}

export function WebsiteEmbed({ source }: { source: string }) {
  const config = useMemo(() => parseWebsiteConfig(source), [source]);
  const { url } = config;
  const frame = useRef<HTMLIFrameElement>(null);
  const frameHost = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const nativeLabel = useRef<string | null>(null);
  const [fillSlide, setFillSlide] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadRevision, setReloadRevision] = useState(0);
  const [nativeError, setNativeError] = useState("");
  const [viewportMode, setViewportMode] = useState<ViewportMode>(initialViewportMode);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const viewportModeRef = useRef(viewportMode);
  const nativeBrowser = isTauri();

  viewportModeRef.current = viewportMode;

  useEffect(() => {
    if (!frameHost.current) return;
    const update = () => {
      const rect = frameHost.current?.getBoundingClientRect();
      if (rect) setHostSize((size) => size.width === rect.width && size.height === rect.height ? size : { width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frameHost.current);
    return () => observer.disconnect();
  }, [fillSlide, fullscreen]);

  useEffect(() => {
    if (!nativeBrowser || !url || !frameHost.current) return;
    const label = `website-${crypto.randomUUID().replace(/[^a-z\d]/gi, "").slice(0, 24)}`;
    nativeLabel.current = label;
    let disposed = false;
    let ready = false;
    const bounds = () => {
      const rect = frameHost.current?.getBoundingClientRect();
      return rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null;
    };
    const syncBounds = () => {
      const next = bounds();
      if (!ready || !next) return;
      invoke("position_website_embed", { label, bounds: next, zoom: viewportZoom(next.width, viewportModeRef.current) }).catch(() => undefined);
    };
    const initialBounds = bounds();
    if (!initialBounds) return;
    setNativeError("");
    invoke("create_website_embed", { label, url: url.href, bounds: initialBounds, zoom: viewportZoom(initialBounds.width, viewportModeRef.current) })
      .then(() => {
        ready = true;
        if (disposed) invoke("close_website_embed", { label }).catch(() => undefined);
        else syncBounds();
      })
      .catch((error) => {
        if (!disposed) setNativeError(error instanceof Error ? error.message : String(error));
      });
    const observer = new ResizeObserver(syncBounds);
    observer.observe(frameHost.current);
    window.addEventListener("resize", syncBounds);
    window.addEventListener("scroll", syncBounds, true);
    return () => {
      disposed = true;
      ready = false;
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("scroll", syncBounds, true);
      if (nativeLabel.current === label) nativeLabel.current = null;
      invoke("close_website_embed", { label }).catch(() => undefined);
    };
  }, [fillSlide, fullscreen, nativeBrowser, reloadRevision, url?.href]);

  useEffect(() => {
    localStorage.setItem("presenta:website-viewport", viewportMode);
    const rect = frameHost.current?.getBoundingClientRect();
    if (!nativeBrowser || !nativeLabel.current || !rect) return;
    invoke("position_website_embed", {
      label: nativeLabel.current,
      bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      zoom: viewportZoom(rect.width, viewportMode),
    }).catch(() => undefined);
  }, [nativeBrowser, viewportMode]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  if (!url || config.error) return <div className="website-error">{config.error}</div>;

  const reload = () => {
    if (nativeBrowser) setReloadRevision((value) => value + 1);
    else if (frame.current) frame.current.src = url.href;
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement === container.current) await document.exitFullscreen();
    else await container.current?.requestFullscreen();
  };

  const customStyle = !fillSlide && !fullscreen ? config.style : undefined;
  const targetWidth = viewportWidths[viewportMode];
  const effectiveViewportWidth = targetWidth && hostSize.width ? Math.max(targetWidth, hostSize.width) : hostSize.width;
  const browserScale = hostSize.width && effectiveViewportWidth ? hostSize.width / effectiveViewportWidth : 1;
  const browserFrameStyle = !nativeBrowser && targetWidth && hostSize.width ? {
    width: `${effectiveViewportWidth}px`,
    height: `${hostSize.height / browserScale}px`,
    transform: `scale(${browserScale})`,
    transformOrigin: "top left",
  } : undefined;
  return <div ref={container} className={`website-embed${config.customHeight ? " website-custom-height" : ""}${fillSlide ? " website-fill-slide" : ""}`} style={customStyle}>
    <div ref={frameHost} className="website-frame">
      {!nativeBrowser && <iframe ref={frame} src={url.href} style={browserFrameStyle} title={`Embedded website: ${url.hostname}`} referrerPolicy="strict-origin-when-cross-origin" allow="clipboard-read; clipboard-write; fullscreen" />}
      <div className="website-export-card">
        <b>{url.hostname}</b>
        <small>{url.href}</small>
      </div>
      {nativeError && <div className="website-native-error"><b>Could not load the embedded website</b><small>{nativeError}</small><a href={url.href} target="_blank" rel="noreferrer">Open website</a></div>}
    </div>
    <div className="website-controls" role="toolbar" aria-label="Website controls" onPointerDown={(event) => event.stopPropagation()}>
      <span className="website-address" title={url.href}><i />{url.hostname}</span>
      <label className="website-viewport" title="Responsive viewport"><MonitorSmartphone /><select value={viewportMode} onChange={(event) => setViewportMode(event.target.value as ViewportMode)} aria-label="Website viewport"><option value="auto">Auto</option><option value="desktop">Desktop · 1440</option><option value="tablet">Tablet · 768</option><option value="mobile">Mobile · 390</option></select></label>
      <button type="button" onClick={reload} title="Reload website"><RefreshCw /></button>
      <a href={url.href} target="_blank" rel="noreferrer" title="Open website"><ExternalLink /></a>
      <button type="button" onClick={() => setFillSlide((value) => !value)} title={fillSlide ? "Restore website size" : "Fill slide"}>{fillSlide ? <Minimize2 /> : <Maximize2 />}<b>{fillSlide ? "Restore" : "Fill slide"}</b></button>
      <button type="button" onClick={() => toggleFullscreen().catch(() => undefined)} title={fullscreen ? "Exit fullscreen" : "Open fullscreen"}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</button>
    </div>
  </div>;
}

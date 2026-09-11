import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

function parseOption(source: string): EChartsOption {
  const value: unknown = JSON.parse(source);
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("The chart option must be a JSON object.");
  }
  return value as EChartsOption;
}

export function EChart({ source, theme }: { source: string; theme: "light" | "dark" }) {
  const container = useRef<HTMLDivElement>(null);
  const [renderFailure, setRenderFailure] = useState<{ source: string; message: string } | null>(null);
  const parsed = useMemo(() => {
    try {
      return { option: parseOption(source), error: null };
    } catch (error) {
      return { option: null, error: error instanceof Error ? error.message : "Invalid chart option." };
    }
  }, [source]);

  useEffect(() => {
    const element = container.current;
    if (!element || !parsed.option) return;

    setRenderFailure(null);
    const chart = echarts.init(element, theme, { renderer: "canvas" });
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);

    try {
      const option = document.body.classList.contains("exporting")
        ? { ...parsed.option, animation: false }
        : parsed.option;
      chart.setOption(option, { notMerge: true });
    } catch (error) {
      setRenderFailure({ source, message: error instanceof Error ? error.message : "ECharts could not render this option." });
    }

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [parsed.option, source, theme]);

  const error = parsed.error ?? (renderFailure?.source === source ? renderFailure.message : null);
  return <div className={`echart-frame${error ? " invalid" : ""}`}>
    {error
      ? <div className="echart-error" role="alert"><strong>Chart error</strong><span>{error}</span></div>
      : <div className="echart-canvas" ref={container} role="img" aria-label="Data chart" />}
  </div>;
}

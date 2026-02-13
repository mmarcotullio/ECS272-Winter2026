import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useContainerSize } from "../hooks/useContainerSize";

export interface GraphNode {
  id: string;
  type: "country" | "discipline";
}

export interface GraphLink {
  source: string;
  target: string;
  medal: string;
  athlete?: string;
  event?: string;
  count?: number;
}

interface GraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
}

const medalColors: Record<string, string> = {
  "Gold Medal": "#fdd10d",
  "Silver Medal": "#C0C0C0",
  "Bronze Medal": "#a45506",
};

type SimNode = GraphNode & d3.SimulationNodeDatum;

type SimLink = GraphLink & d3.SimulationLinkDatum<SimNode>;

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export const MedalGraph: React.FC<GraphProps> = ({ nodes, links }) => {
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const legendRef = useRef<SVGSVGElement | null>(null);

  const allCountries = useMemo(
    () => uniqSorted(nodes.filter((n) => n.type === "country").map((n) => n.id)),
    [nodes]
  );

  const allDisciplines = useMemo(
    () => uniqSorted(nodes.filter((n) => n.type === "discipline").map((n) => n.id)),
    [nodes]
  );

  const allMedals = useMemo(() => uniqSorted(links.map((l) => l.medal)), [links]);

  const [selectedCountry, setSelectedCountry] = useState<string>("All");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("All");
  const [selectedMedal, setSelectedMedal] = useState<string>("All");
  const [minCount, setMinCount] = useState<number>(1);
  const [showOnlyConnected, setShowOnlyConnected] = useState<boolean>(true);

  useEffect(() => {
    const maxC = Math.max(1, ...links.map((l) => l.count ?? 1));
    setMinCount((c) => clamp(c, 1, maxC));
  }, [links]);

  const filteredLinks = useMemo(() => {
    const wantedCountry = selectedCountry !== "All" ? selectedCountry : null;
    const wantedDiscipline = selectedDiscipline !== "All" ? selectedDiscipline : null;
    const wantedMedal = selectedMedal !== "All" ? selectedMedal : null;

    return links.filter((l) => {
      const src = l.source;
      const tgt = l.target;

      if (wantedMedal && l.medal !== wantedMedal) return false;

      const c = l.count ?? 1;
      if (c < minCount) return false;

      if (wantedCountry) {
        if (!(src === wantedCountry || tgt === wantedCountry)) return false;
      }
      if (wantedDiscipline) {
        if (!(src === wantedDiscipline || tgt === wantedDiscipline)) return false;
      }

      return true;
    });
  }, [links, selectedCountry, selectedDiscipline, selectedMedal, minCount]);

  const filteredNodeIds = useMemo(() => {
    const s = new Set<string>();
    for (const l of filteredLinks) {
      s.add(l.source);
      s.add(l.target);
    }
    return s;
  }, [filteredLinks]);

  const filteredNodes = useMemo(() => {
    if (!showOnlyConnected) return nodes;
    return nodes.filter((n) => filteredNodeIds.has(n.id));
  }, [nodes, filteredNodeIds, showOnlyConnected]);

  useEffect(() => {
    if (!filteredNodes.length) return;
    if (!svgRef.current || !legendRef.current) return;
    if (size.width === 0 || size.height === 0) return;

    const width = size.width;
    const height = Math.max(260, size.height);

    const svg = d3
      .select(svgRef.current as SVGSVGElement)
      .attr("width", width)
      .attr("height", height);

    svg.selectAll("*").remove();
    const g = svg.append("g");

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "rgba(0,0,0,0.85)")
      .style("color", "white")
      .style("padding", "8px 10px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("line-height", "1.2");

    const showTooltip = (html: string, event: MouseEvent) => {
      tooltip
        .style("opacity", 1)
        .html(html)
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    };
    const moveTooltip = (event: MouseEvent) => {
      tooltip.style("left", event.pageX + 12 + "px").style("top", event.pageY + 12 + "px");
    };
    const hideTooltip = () => tooltip.style("opacity", 0);

    const simNodes: SimNode[] = filteredNodes.map((d) => ({ ...d }));
    const simLinks: SimLink[] = filteredLinks.map((d) => ({ ...d })) as SimLink[];

    const degree: Record<string, number> = {};
    for (const l of filteredLinks) {
      degree[l.source] = (degree[l.source] || 0) + 1;
      degree[l.target] = (degree[l.target] || 0) + 1;
    }
    const rCountry = (id: string) => clamp(10 + (degree[id] || 0) * 0.8, 12, 24);
    const rDiscipline = (id: string) => clamp(7 + (degree[id] || 0) * 0.6, 9, 18);

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(130)
          .strength(0.7)
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force(
        "collide",
        d3
          .forceCollide<SimNode>()
          .radius((d) => (d.type === "country" ? rCountry(d.id) : rDiscipline(d.id)) + 4)
      )
      .force("center", d3.forceCenter(width / 2, height / 2));

    const linkSel = g
      .append("g")
      .attr("stroke-linecap", "round")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d) => medalColors[d.medal] || "#000")
      .attr("stroke-width", (d) => clamp(1.5 + (d.count ?? 1) * 0.3, 1.5, 6))
      .attr("opacity", 0.9)
      .on("mouseover", (event, d) => {
        const athlete = d.athlete ? `<strong>${d.athlete}</strong><br/>` : "";
        const ev = d.event ? `${d.event}<br/>` : "";
        const cnt = d.count != null ? `Count: ${d.count}<br/>` : "";
        showTooltip(`${athlete}${ev}${cnt}${d.medal}`, event as unknown as MouseEvent);
      })
      .on("mousemove", (event) => moveTooltip(event as unknown as MouseEvent))
      .on("mouseout", hideTooltip);

    const nodeSel = g
      .append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (d) => (d.type === "country" ? rCountry(d.id) : rDiscipline(d.id)))
      .attr("fill", (d) => (d.type === "country" ? "#69b3a2" : "#1f77b4"))
      .attr("stroke", "#111827")
      .attr("stroke-width", 0.6)
      .on("mouseover", (event, d) => {
        const deg = degree[d.id] || 0;
        showTooltip(`<strong>${d.id}</strong><br/>${d.type}<br/>Links: ${deg}`, event as unknown as MouseEvent);
      })
      .on("mousemove", (event) => moveTooltip(event as unknown as MouseEvent))
      .on("mouseout", hideTooltip);

    const drag = d3
      .drag<SVGCircleElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x ?? 0;
        d.fy = d.y ?? 0;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(drag as any);

    const labels = g
      .append("g")
      .selectAll<SVGTextElement, SimNode>("text")
      .data(simNodes.filter((d) => d.type === "country"))
      .join("text")
      .text((d) => d.id)
      .attr("font-size", 12)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -(rCountry(d.id) + 6))
      .attr("fill", "#111827")
      .attr("pointer-events", "none");

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      nodeSel.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      labels.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 6])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        })
    );

    const legendSvg = d3.select(legendRef.current as SVGSVGElement);
    legendSvg.selectAll("*").remove();

    const legendNodes = [
      { color: "#69b3a2", label: "Country" },
      { color: "#1f77b4", label: "Discipline" },
    ];
    const legendLinks = Object.entries(medalColors).map(([medal, color]) => ({ color, label: medal }));

    const itemHeight = 25;
    const padding = 10;
    const totalHeight = padding * 2 + (legendNodes.length + legendLinks.length) * itemHeight + 10;

    legendSvg.attr("width", Math.min(320, width)).attr("height", totalHeight);

    const nodeLegend = legendSvg.append("g").attr("transform", `translate(${padding}, ${padding})`);

    nodeLegend
      .selectAll("rect")
      .data(legendNodes)
      .join("rect")
      .attr("x", 0)
      .attr("y", (_, i) => i * itemHeight)
      .attr("width", 20)
      .attr("height", 20)
      .attr("fill", (d) => d.color);

    nodeLegend
      .selectAll("text")
      .data(legendNodes)
      .join("text")
      .attr("x", 25)
      .attr("y", (_, i) => i * itemHeight + 15)
      .text((d) => d.label)
      .attr("font-size", 12);

    const linkLegend = legendSvg
      .append("g")
      .attr("transform", `translate(${padding}, ${padding + legendNodes.length * itemHeight + 10})`);

    linkLegend
      .selectAll("rect")
      .data(legendLinks)
      .join("rect")
      .attr("x", 0)
      .attr("y", (_, i) => i * itemHeight)
      .attr("width", 20)
      .attr("height", 20)
      .attr("fill", (d) => d.color);

    linkLegend
      .selectAll("text")
      .data(legendLinks)
      .join("text")
      .attr("x", 25)
      .attr("y", (_, i) => i * itemHeight + 15)
      .text((d) => d.label)
      .attr("font-size", 12);

    return () => {
      tooltip.remove();
      simulation.stop();
    };
  }, [filteredNodes, filteredLinks, size.width, size.height]);

  const maxCount = useMemo(() => Math.max(1, ...links.map((l) => l.count ?? 1)), [links]);

  const resetFilters = () => {
    setSelectedCountry("All");
    setSelectedDiscipline("All");
    setSelectedMedal("All");
    setMinCount(1);
    setShowOnlyConnected(true);
  };

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* FILTER BAR */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
          padding: "0.5rem 0",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
          Country
          <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} style={{ padding: "6px 8px" }}>
            <option value="All">All</option>
            {allCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
          Discipline
          <select
            value={selectedDiscipline}
            onChange={(e) => setSelectedDiscipline(e.target.value)}
            style={{ padding: "6px 8px" }}
          >
            <option value="All">All</option>
            {allDisciplines.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
          Medal
          <select value={selectedMedal} onChange={(e) => setSelectedMedal(e.target.value)} style={{ padding: "6px 8px" }}>
            <option value="All">All</option>
            {allMedals.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 12, minWidth: 180 }}>
          Min count: {minCount}
          <input
            type="range"
            min={1}
            max={maxCount}
            step={1}
            value={minCount}
            onChange={(e) => setMinCount(Number(e.target.value))}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input type="checkbox" checked={showOnlyConnected} onChange={(e) => setShowOnlyConnected(e.target.checked)} />
          Hide unconnected nodes
        </label>

        <button onClick={resetFilters} style={{ padding: "8px 10px", fontSize: 12 }}>
          Reset
        </button>

        <div style={{ marginLeft: "auto", marginRight: "1.5rem", fontSize: 12, opacity: 0.8 }}>


          Showing <strong>{filteredNodes.length}</strong> nodes / <strong>{filteredLinks.length}</strong> links
        </div>
      </div>

      <svg ref={svgRef} style={{ flex: 1, minHeight: 0 }} />
      <svg ref={legendRef} style={{ marginTop: 10 }} />
    </div>
  );
};

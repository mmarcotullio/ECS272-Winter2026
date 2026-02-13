import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry, Feature } from "geojson";
import { useContainerSize } from "../hooks/useContainerSize";

export interface Athlete {
  code: string;
  name: string;
  gender: string;
  country: string;
  disciplines: string[];
}

type CountryFeature = Feature<Geometry, any>;

function normalizeDiscipline(raw: unknown): string {
  if (raw == null) return "";

  let s = typeof raw === "string" ? raw : String(raw);
  s = s.trim();

  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        return typeof first === "string" ? first.trim() : String(first).trim();
      }
    } catch {
    }
  }

  if (s.startsWith("[") && s.endsWith("]")) {
    s = s.slice(1, -1).trim();
  }

  s = s.replace(/^['"]+|['"]+$/g, "").trim();

  if (s.includes(",")) {
    s = s.split(",")[0].trim().replace(/^['"]+|['"]+$/g, "").trim();
  }

  return s;
}

export const AthleteMap: React.FC<{ data: Athlete[] }> = ({ data }) => {
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const countriesRef = useRef<CountryFeature[]>([]);

  const [worldReady, setWorldReady] = useState(false);

  const [discipline, setDiscipline] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [gender, setGender] = useState<string>("All");
  const [filtered, setFiltered] = useState<Athlete[]>([]);
  const [showMessage, setShowMessage] = useState(false);

  const color = useMemo(
    () =>
      d3
        .scaleOrdinal<string>()
        .domain(["Male", "Female", "Unknown"])
        .range(["#2563eb", "#ec4899", "#9ca3af"]),
    []
  );

  const normalizedDisciplinesByAthlete = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of data) {
      const norm = (a.disciplines ?? [])
        .map(normalizeDiscipline)
        .filter((x) => x.length > 0);
      map.set(a.code, norm);
    }
    return map;
  }, [data]);

  const disciplines = useMemo(() => {
    const all = data.flatMap((a) => normalizedDisciplinesByAthlete.get(a.code) ?? []);
    return Array.from(new Set(all)).sort();
  }, [data, normalizedDisciplinesByAthlete]);

  const countries = useMemo(
    () => Array.from(new Set(data.map((d) => d.country))).sort(),
    [data]
  );

  const genders = useMemo(
    () => ["All", ...Array.from(new Set(data.map((d) => d.gender))).sort()],
    [data]
  );

  const countryNameMap: Record<string, string> = {
    "United States": "United States of America",
    Russia: "Russian Federation",
    "South Korea": "Korea",
    "North Korea": "Dem. Rep. Korea",
  };

  const refreshMap = () => {
    if (!discipline || !country) return;

    const d = data.filter((a) => {
      const normDisciplines = normalizedDisciplinesByAthlete.get(a.code) ?? [];
      return (
        normDisciplines.includes(discipline) &&
        a.country === country &&
        (gender === "All" || a.gender === gender)
      );
    });

    setFiltered(d);

    if (d.length === 0) {
      setShowMessage(true);
      window.setTimeout(() => setShowMessage(false), 3000);
    }
  };

  useEffect(() => {
    let cancelled = false;

    d3.json("https://unpkg.com/world-atlas@2/countries-110m.json")
      .then((world: any) => {
        if (cancelled) return;
        const geo = feature(world, world.objects.countries) as unknown as FeatureCollection<Geometry>;
        countriesRef.current = geo.features as CountryFeature[];
        setWorldReady(true);
      })
      .catch((err) => {
        console.error("Failed to load world atlas:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    if (!worldReady) return;
    if (size.width === 0 || size.height === 0) return;

    const svg = d3.select(svgRef.current as SVGSVGElement);
    svg.selectAll("*").remove();

    const width = size.width;
    const height = size.height;

    svg.attr("width", width).attr("height", height);

    const projection = d3
      .geoNaturalEarth1()
      .fitSize([width, height], {
        type: "FeatureCollection",
        features: countriesRef.current,
      } as any);

    const path = d3.geoPath(projection);

    svg
      .append("g")
      .selectAll("path")
      .data(countriesRef.current)
      .enter()
      .append("path")
      .attr("d", path as any)
      .attr("fill", "#e5e7eb")
      .attr("stroke", "#9ca3af");

    drawLegend(svg, color);
  }, [worldReady, size.width, size.height, color]);

  const randomPointInCountry = (feat: CountryFeature, count: number): [number, number] => {
    const [lon0, lat0] = d3.geoCentroid(feat);

    const maxSpread = Math.min(15, 2 + count * 0.4);
    for (let i = 0; i < 80; i++) {
      const lon = lon0 + d3.randomUniform(-maxSpread, maxSpread)();
      const lat = lat0 + d3.randomUniform(-maxSpread, maxSpread)();
      if (d3.geoContains(feat, [lon, lat])) return [lon, lat];
    }
    return [lon0, lat0];
  };

    useEffect(() => {
    if (!svgRef.current) return;
    if (!worldReady) return;
    if (size.width === 0 || size.height === 0) return;

    const svg = d3.select(svgRef.current as SVGSVGElement);

    const width = size.width;
    const height = size.height;

    const projection = d3
        .geoNaturalEarth1()
        .fitSize([width, height], {
        type: "FeatureCollection",
        features: countriesRef.current,
        } as any);

    const countryCounts: Record<string, number> = {};
    filtered.forEach((a) => {
        countryCounts[a.country] = (countryCounts[a.country] || 0) + 1;
    });

    const pinData = filtered
        .map((d) => {
        const mappedName = countryNameMap[d.country] || d.country;
        const feat = countriesRef.current.find((c) => c.properties?.name === mappedName);
        if (!feat) return null;

        const pt = randomPointInCountry(feat, countryCounts[d.country] || 1);
        const projected = projection(pt);
        if (!projected) return null;

        const [x, y] = projected;
        return { ...d, x, y };
        })
        .filter(Boolean) as Array<Athlete & { x: number; y: number }>;

    svg.selectAll(".pin").remove();

    const pins = svg
        .selectAll<SVGCircleElement, Athlete & { x: number; y: number }>(".pin")
        .data(pinData)
        .enter()
        .append("circle")
        .attr("class", "pin")
        .attr("r", 5)
        .attr("fill", (d) => color(d.gender))
        .attr("cx", (d) => d.x)
        .attr("cy", -30); 

    pins
        .transition()
        .duration(700)
        .delay((_, i) => i * 15)
        .attr("cy", (d) => d.y);
    }, [worldReady, filtered, size.width, size.height, color]);


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
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="" disabled>
            Select discipline
          </option>
          {disciplines.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="" disabled>
            Select country
          </option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          {genders.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <button onClick={refreshMap} disabled={!discipline || !country}>
          Refresh Map
        </button>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {showMessage && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255, 0, 0, 0.85)",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: 4,
              zIndex: 10,
            }}
          >
            No athletes found under selection
          </div>
        )}

        <svg ref={svgRef} />
      </div>
    </div>
  );
};

function drawLegend(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  color: d3.ScaleOrdinal<string, string>
) {
  const legend = svg.append("g").attr("transform", "translate(30, 30)");

  legend.append("text").text("Gender").attr("font-weight", "bold").attr("y", -16);

  color.domain().forEach((g, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);

    row.append("circle").attr("r", 6).attr("fill", color(g));

    row.append("text").attr("x", 12).attr("y", 4).text(g);
  });
}

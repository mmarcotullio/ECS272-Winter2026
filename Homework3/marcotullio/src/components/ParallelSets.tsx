import { useEffect, useMemo, useState } from "react";
import * as Papa from "papaparse";

import {
  Box,
  MenuItem,
  Select,
  Typography,
  FormControl,
  InputLabel,
  Slider,
  Stack,
} from "@mui/material";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";

type AnyRow = Record<string, any>;

type SankeyNode = { name: string };
type SankeyLink = { source: number; target: number; value: number };

interface AthleteRec {
  athlete?: string;
  country: string; 
  sport: string;
  medal?: string;
}

type MedalKey = string;

function norm(s: any) {
  return String(s ?? "").trim();
}
function lower(s: any) {
  return norm(s).toLowerCase();
}

function parseList(v: any): string[] {
  const s = norm(v);
  if (!s) return [];

  try {
    const j = JSON.parse(s.replace(/'/g, '"'));
    if (Array.isArray(j)) return j.map((x) => norm(x)).filter(Boolean);
    if (typeof j === "string") return [j].filter(Boolean);
  } catch {
    return s
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .replace(/'/g, "")
      .split(",")
      .map((x) => norm(x))
      .filter(Boolean);
  }

  return [];
}

function pickFieldFuzzy(row: AnyRow, candidates: string[]) {
  const keys = Object.keys(row);
  const key = keys.find((k) => {
    const lk = lower(k);
    return candidates.some((c) => lk === c || lk.includes(c));
  });
  return key ? row[key] : "";
}

export function ParallelSets() {
  const [athletesRaw, setAthletesRaw] = useState<AnyRow[]>([]);
  const [medalsRaw, setMedalsRaw] = useState<AnyRow[] | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("__ALL__");

  const [topCountries, setTopCountries] = useState<number>(20);
  const [topSports, setTopSports] = useState<number>(16);

  useEffect(() => {
    Papa.parse("/data/archive/athletes.csv", {
      header: true,
      download: true,
      skipEmptyLines: true,
      complete: (results) => setAthletesRaw(results.data as AnyRow[]),
      error: (err) => console.error("Failed to load athletes.csv:", err),
    });

    Papa.parse("/data/archive/medals.csv", {
      header: true,
      download: true,
      skipEmptyLines: true,
      complete: (results) => setMedalsRaw(results.data as AnyRow[]),
      error: () => setMedalsRaw(null),
    });
  }, []);

  const athletes: AthleteRec[] = useMemo(() => {
    if (!athletesRaw.length) return [];

    return athletesRaw
      .flatMap((r) => {
        const athlete = norm(r.name); 
        const country = norm(r.country); 
        const disciplines = parseList(r.disciplines);

        return disciplines.map((sport) => ({
          athlete,
          country,
          sport,
          medal: "", 
        }));
      })
      .filter((a) => a.country && a.sport);
  }, [athletesRaw]);

  const medalLookup: Set<MedalKey> = useMemo(() => {
    const set = new Set<MedalKey>();
    if (!medalsRaw?.length) return set;

    for (const r of medalsRaw) {
      const athlete = norm(
        pickFieldFuzzy(r, ["athlete", "name", "competitor", "athlete_name", "person", "full_name"])
      );
      const country = norm(
        pickFieldFuzzy(r, ["country", "noc", "team", "nation", "country_name", "country_long"])
      );

      const sport = norm(
        pickFieldFuzzy(r, ["sport", "discipline", "event", "discipline_name", "sport_name", "disciplines"])
      );

      if (athlete && country && sport) set.add(`${lower(athlete)}|${lower(country)}|${lower(sport)}`);
      if (athlete && country) set.add(`${lower(athlete)}|${lower(country)}`);
    }

    return set;
  }, [medalsRaw]);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of athletes) counts.set(a.country, (counts.get(a.country) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [athletes]);

  const filtered = useMemo(() => {
    if (!athletes.length) return [];
    if (selectedCountry !== "__ALL__") return athletes.filter((a) => a.country === selectedCountry);
    const topCountrySet = new Set(countries.slice(0, topCountries));
    return athletes.filter((a) => topCountrySet.has(a.country));
  }, [athletes, selectedCountry, countries, topCountries]);

  const topSportSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of filtered) counts.set(a.sport, (counts.get(a.sport) ?? 0) + 1);
    return new Set(
      Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topSports)
        .map(([s]) => s)
    );
  }, [filtered, topSports]);

  const { nodes, links } = useMemo((): { nodes: SankeyNode[]; links: SankeyLink[] } => {
    const nodeMap = new Map<string, number>();
    const nodesArr: SankeyNode[] = [];
    const linksArr: SankeyLink[] = [];

    const getIndex = (name: string) => {
      const existing = nodeMap.get(name);
      if (existing !== undefined) return existing;
      const idx = nodesArr.length;
      nodeMap.set(name, idx);
      nodesArr.push({ name });
      return idx;
    };

    const cs = new Map<string, number>(); 
    const so = new Map<string, number>();

    for (const a of filtered) {
      if (!topSportSet.has(a.sport)) continue;

      const athleteKeyFull = `${lower(a.athlete)}|${lower(a.country)}|${lower(a.sport)}`;
      const athleteKeyLoose = `${lower(a.athlete)}|${lower(a.country)}`;

      const hasMedalFromAthletes =
        !!a.medal && lower(a.medal) !== "na" && lower(a.medal) !== "none" && lower(a.medal) !== "";
      const hasMedalFromMedals = medalLookup.has(athleteKeyFull) || medalLookup.has(athleteKeyLoose);

      const outcome = hasMedalFromAthletes || hasMedalFromMedals ? "Medalist" : "Participant";

      const k1 = `${a.country}|||${a.sport}`;
      cs.set(k1, (cs.get(k1) ?? 0) + 1);

      const k2 = `${a.sport}|||${outcome}`;
      so.set(k2, (so.get(k2) ?? 0) + 1);
    }

    const countryLabel = (c: string) => c;
    const sportLabel = (s: string) => s;
    const outcomeLabel = (o: string) => o;

    // Country to Sport
    for (const [k, v] of Array.from(cs)) {
      const [country, sport] = k.split("|||");
      linksArr.push({
        source: getIndex(countryLabel(country)),
        target: getIndex(sportLabel(sport)),
        value: v,
      });
    }

    // Sport to Outcome
    for (const [k, v] of Array.from(so)) {
      const [sport, outcome] = k.split("|||");
      linksArr.push({
        source: getIndex(sportLabel(sport)),
        target: getIndex(outcomeLabel(outcome)),
        value: v,
      });
    }

    return { nodes: nodesArr, links: linksArr };
  }, [filtered, topSportSet, medalLookup]);

  const title = useMemo(() => {
    if (selectedCountry === "__ALL__") return "Country Participation in Sport Events";
    return `${selectedCountry}: Country Participation in Sport Events`;
  }, [selectedCountry]);

  const hasData = nodes.length > 0 && links.length > 0;

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Typography variant="h6" sx={{ mb: 1, flex: "0 0 auto" }}>
        {title}
      </Typography>

      <Stack spacing={1.5} sx={{ mb: 1.5, flex: "0 0 auto" }}>
        <FormControl size="small" fullWidth>
          <InputLabel id="country-select-label">Country</InputLabel>
          <Select
            labelId="country-select-label"
            label="Country"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(String(e.target.value))}
          >
            <MenuItem value="__ALL__">All (top {topCountries})</MenuItem>
            {countries.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Top countries (only when “All”): {topCountries}
          </Typography>
          <Slider
            size="small"
            value={topCountries}
            min={5}
            max={60}
            step={1}
            onChange={(_, v) => setTopCountries(Number(v))}
            disabled={selectedCountry !== "__ALL__"}
          />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Top sports: {topSports}
          </Typography>
          <Slider
            size="small"
            value={topSports}
            min={5}
            max={50}
            step={1}
            onChange={(_, v) => setTopSports(Number(v))}
          />
        </Box>
      </Stack>

      <Box
        sx={{
          flex: "1 1 auto",
          minHeight: 260,
          overflow: "hidden",
        }}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={{ nodes, links }}
              nodePadding={10}
              nodeWidth={10}
              iterations={64}
              margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
            >
              <Tooltip />
            </Sankey>
          </ResponsiveContainer>
        ) : (
          <Typography sx={{ color: "text.secondary", textAlign: "center", mt: 2 }}>
            Loading data...
          </Typography>
        )}
      </Box>
    </Box>
  );
}

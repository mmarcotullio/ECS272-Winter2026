// src/App.tsx
import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { grey } from "@mui/material/colors";
import Papa from "papaparse";

import { AthleteMap, Athlete } from "./components/AthleteMap";
import { MedalGraph, GraphNode, GraphLink } from "./components/MedalGraph";
import { ParallelSets } from "./components/ParallelSets";
import logo from "./images/Paris-2024-Olympics-Logo.png";


const theme = createTheme({
  palette: {
    primary: { main: grey[700] },
    secondary: { main: grey[700] },
  },
});

interface Medal {
  medal_type: string;
  medal_code: number;
  medal_date: Date;
  name: string;
  gender: "M" | "W";
  discipline: string;
  event: string;
  event_type: string;
  url_event: string;
  code: number;
  country_code: string;
  country: string;
  country_long: string;
}

function Layout() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  });

  useEffect(() => {
    Papa.parse("/data/archive/athletes.csv", {
      header: true,
      download: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const parsed: Athlete[] = (results.data as any[]).map((row) => {
          const raw = row.disciplines;
          const disciplines =
            Array.isArray(raw)
              ? raw
              : typeof raw === "string" && raw.length
              ? raw
                  .replace(/^\[/, "")
                  .replace(/\]$/, "")
                  .replace(/'/g, "")
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [];

          return { ...row, disciplines };
        });

        setAthletes(parsed);
      },
      error: (err) => console.error(err),
    });
  }, []);

  useEffect(() => {
    Papa.parse("/data/archive/medals.csv", {
      header: true,
      download: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const parsed: Medal[] = (results.data as any[]).map((row) => ({
          ...row,
          medal_code: Number(row.medal_code),
          code: Number(row.code),
          medal_date: new Date(row.medal_date),
        }));

        const countries = Array.from(new Set(parsed.map((m) => m.country)));
        const disciplines = Array.from(new Set(parsed.map((m) => m.discipline)));

        const nodes: GraphNode[] = [
          ...countries.map((c) => ({ id: c, type: "country" as const })),
          ...disciplines.map((d) => ({ id: d, type: "discipline" as const })),
        ];

        const linkMap: Record<
          string,
          { count: number; athlete: string[]; event: string[]; medal: string }
        > = {};

        parsed.forEach((m) => {
          const key = `${m.country}|${m.discipline}|${m.medal_type}`;
          if (!linkMap[key]) {
            linkMap[key] = { count: 1, athlete: [m.name], event: [m.event], medal: m.medal_type };
          } else {
            linkMap[key].count += 1;
            linkMap[key].athlete.push(m.name);
            linkMap[key].event.push(m.event);
          }
        });

        const links: GraphLink[] = Object.entries(linkMap).map(([key, value]) => {
          const [source, target, medal] = key.split("|");
          return {
            source,
            target,
            medal,
            athlete: value.athlete.join(", "),
            event: value.event.join(", "),
            count: value.count,
          };
        });

        setGraphData({ nodes, links });
      },
      error: (err) => console.error(err),
    });
  }, []);

  return (
    <Box
    id="main-container"
    sx={{
        minHeight: "100vh",
        p: 2,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
    }}
    >

        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
        <img
            src={logo}
            alt="Paris 2024 Logo"
            style={{
            height: "100px",
            objectFit: "contain",
            }}
        />
        </Box>
      <Typography variant="h4" sx={{ mb: 2, textAlign: "center" }}>
        Paris 2024 Summer Olympic Games
      </Typography>

      {/* Responsive layout */}
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{ flex: 1, minHeight: 0 }}
      >
        {/* ---- Sankey Chart ---- */}
        <Box
          sx={{
            flex: 1,
            border: "1px solid #ccc",
            p: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <ParallelSets />
          </Box>
        </Box>

        {/* ---- Athlete Map ---- */}
        <Box
          sx={{
            flex: 2,
            border: "1px solid #ccc",
            p: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            Athlete Map
          </Typography>

          <Box sx={{ flex: 1, minHeight: 0 }}>
            {athletes.length > 0 ? (
              <AthleteMap data={athletes} />
            ) : (
              <div>Loading athletes...</div>
            )}
          </Box>
        </Box>

        {/* ---- Medal Graph ---- */}
        <Box
          sx={{
            flex: 1,
            border: "1px solid #ccc",
            p: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            Country, Discipline, and Medal Graph
          </Typography>

          <Box sx={{ flex: 1, minHeight: 0 }}>
            {graphData.nodes.length > 0 ? (
              <MedalGraph nodes={graphData.nodes} links={graphData.links} />
            ) : (
              <div>Loading medal graph...</div>
            )}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <Layout />
    </ThemeProvider>
  );
}

import React, { useMemo, useState, useEffect, useRef } from "react";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Checkbox,
  IconButton,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Scatter,
  Legend,
} from "recharts";

/* ─────────────────────────── Types ─────────────────────────── */
const COLORS = [
  "#1976d2",
  "#d32f2f",
  "#388e3c",
  "#fbc02d",
  "#7b1fa2",
  "#0097a7",
  "#5d4037",
];

export type MethodKey = "KMeans" | "DBSCAN";
export type DatasetKey = "dataset1" | "dataset2";
export type NormKey = "L1" | "L2" | "L∞";

interface Point {
  x: number;
  y: number;
}
interface LabeledPoint extends Point {
  cluster: number; // -1 indicates noise (DBSCAN)
}

/* A saved run that can be toggled on/off in the filter panel */
interface SavedRun {
  /** unique id */
  id: string;
  /** which dataset this run belongs to */
  dataset: DatasetKey;
  /** algorithm */
  method: MethodKey;
  /** parameters description – helps users remember what they ran */
  paramsDesc: string;
  /** distance metric */
  norm: NormKey;
  /** clustering result */
  points: LabeledPoint[];
  /** visibility in chart */
  visible: boolean;
  /** base colour index – each cluster inside gets its own shade */
  colorSeed: number;
  /** small offset index for deterministic jitter */
  offsetIndex: number;
}

/* ─────────────────── Helper: circle boundary generator ─────────────────── */
const generateCirclePoints = (
  cx: number,
  cy: number,
  r: number,
  n: number
): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

/* ───────────────────────── Distance helpers ───────────────────────── */
const calcDistance = (a: Point, b: Point, norm: NormKey): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  switch (norm) {
    case "L1":
      return Math.abs(dx) + Math.abs(dy);
    case "L2":
      return Math.hypot(dx, dy);
    case "L∞":
      return Math.max(Math.abs(dx), Math.abs(dy));
    default:
      return 0;
  }
};

/* ──────────────────── Cache-friendly K-Means ──────────────────── */
function kMeans(
  points: Point[],
  k: number,
  norm: NormKey,
  initialCentroids?: Point[],
  maxIter = 50
): LabeledPoint[] {
  if (k <= 0) return points.map((p) => ({ ...p, cluster: 0 }));

  // 1️⃣ 使用外部传进来的质心，否则随机产生
  const centroids: Point[] =
    initialCentroids && initialCentroids.length === k
      ? initialCentroids.map((c) => ({ ...c })) // 复制一份避免原地修改
      : (() => {
          const cs: Point[] = [];
          const seen = new Set<number>();
          while (cs.length < k) {
            const idx = Math.floor(Math.random() * points.length);
            if (!seen.has(idx)) {
              seen.add(idx);
              cs.push({ ...points[idx] });
            }
          }
          return cs;
        })();

  let labels = new Array(points.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assignment
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      const dists = centroids.map((c) => calcDistance(points[i], c, norm));
      const minIdx = dists.indexOf(Math.min(...dists));
      if (labels[i] !== minIdx) {
        changed = true;
        labels[i] = minIdx;
      }
    }
    if (!changed) break;

    // Update
    const sums = Array.from({ length: k }, () => ({ x: 0, y: 0, n: 0 }));
    labels.forEach((lbl, idx) => {
      const p = points[idx];
      sums[lbl].x += p.x;
      sums[lbl].y += p.y;
      sums[lbl].n += 1;
    });
    sums.forEach((s, idx) => {
      if (s.n > 0) centroids[idx] = { x: s.x / s.n, y: s.y / s.n };
    });
  }
  return points.map((p, i) => ({ ...p, cluster: labels[i] }));
}

/* ───────────────────── Simple DBSCAN (unchanged) ───────────────────── */
function dbscan(
  points: Point[],
  eps: number,
  minPts: number,
  norm: NormKey
): LabeledPoint[] {
  const labels = new Array(points.length).fill(-99); // -99 = undefined
  let clusterId = 0;

  const regionQuery = (idx: number): number[] => {
    const neighbors: number[] = [];
    for (let j = 0; j < points.length; j++) {
      if (calcDistance(points[idx], points[j], norm) <= eps) neighbors.push(j);
    }
    return neighbors;
  };

  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== -99) continue; // visited
    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) {
      labels[i] = -1; // noise
      continue;
    }
    labels[i] = clusterId;
    const seedSet = [...neighbors.filter((n) => n !== i)];
    while (seedSet.length > 0) {
      const current = seedSet.shift()!;
      if (labels[current] === -1) labels[current] = clusterId; // noise → border
      if (labels[current] !== -99) continue;
      labels[current] = clusterId;
      const currentNeighbors = regionQuery(current);
      if (currentNeighbors.length >= minPts) {
        seedSet.push(
          ...currentNeighbors.filter(
            (n) => !seedSet.includes(n) && labels[n] === -99
          )
        );
      }
    }
    clusterId += 1;
  }
  return points.map((p, i) => ({ ...p, cluster: labels[i] }));
}

/* ───────────────────────────── DATASETS ───────────────────────────── */
const DATASETS: Record<DatasetKey, { name: string; points: Point[] }> = {
  dataset1: {
    name: "Gaussian Blobs (toy)",
    points: [
      ...generateCirclePoints(1, 1, 1.2, 60),
      ...generateCirclePoints(5, 5, 1.2, 60),
    ],
  },
  dataset2: {
    name: "Concentric Circles",
    points: [
      ...generateCirclePoints(0, 0, 1.5, 120),
      ...generateCirclePoints(0, 0, 3, 120),
    ],
  },
};

/* ────────────────────── Helper: clusters for chart ────────────────────── */
function splitIntoClusters(points: LabeledPoint[]): Map<number, Point[]> {
  const map = new Map<number, Point[]>();
  points.forEach((p) => {
    const arr = map.get(p.cluster) ?? [];
    arr.push(p);
    map.set(p.cluster, arr);
  });
  return map;
}

/* ────────────────────── Helper: jitter points ────────────────────── */
const JITTER_STEP = 0.18; // adjust if needed
function jitterPoint(p: Point, offsetIndex: number): Point {
  // spread offsets on a 3x3 grid centred at 0
  const dxFactor = (offsetIndex % 3) - 1; // -1,0,1
  const dyFactor = Math.floor(offsetIndex / 3) - 1; // -1,0,1
  return {
    x: p.x + dxFactor * JITTER_STEP,
    y: p.y + dyFactor * JITTER_STEP,
  };
}

/* ────────────────────────── Main Component ────────────────────────── */
const AdvancedLesson: React.FC = () => {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>("dataset1");
  const [methodKey, setMethodKey] = useState<MethodKey>("KMeans");
  const [normKey, setNormKey] = useState<NormKey>("L2");

  // Parameters
  const [kInput, setKInput] = useState("2");
  const [epsInput, setEpsInput] = useState("0.8");
  const [minPtsInput, setMinPtsInput] = useState("4");

  /* All saved runs – across datasets so users can switch back & forth */
  const [runs, setRuns] = useState<SavedRun[]>([]);

  /* 🔔 Warn when user exceeds maximum allowed runs */
  const [warning, setWarning] = useState<string>("");

  /* ✨ 缓存“数据集-k”对应的初始质心 ✨ */
  const initialCentroidsRef = useRef<Point[] | null>(null);
  const centroidKeyRef = useRef<string>("");

  const currentDataset = DATASETS[datasetKey];

  /* ───────── Effect: reset centroid cache & warning on dataset change ───────── */
  useEffect(() => {
    initialCentroidsRef.current = null;
    centroidKeyRef.current = "";
    setWarning("");
  }, [datasetKey]);

  /* ───────── Handler to run clustering ───────── */
  const handleRun = () => {
    // 🚦 Enforce at most 3 runs per dataset
    const existingCount = runs.filter((r) => r.dataset === datasetKey).length;
    if (existingCount >= 3) {
      setWarning("You can save at most three results per dataset. Please delete some before adding new ones.");
      return;
    }

    const pts = currentDataset.points;
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let result: LabeledPoint[] = [];
    let paramsDesc = "";

    if (methodKey === "KMeans") {
      const k = Math.max(1, parseInt(kInput, 10));
      const cacheKey = `${datasetKey}-${k}`; // 只有数据集或 k 变才重新随机
      if (centroidKeyRef.current !== cacheKey || !initialCentroidsRef.current) {
        // 重新随机
        const centroids: Point[] = [];
        const seen = new Set<number>();
        while (centroids.length < k) {
          const idx = Math.floor(Math.random() * pts.length);
          if (!seen.has(idx)) {
            seen.add(idx);
            centroids.push({ ...pts[idx] });
          }
        }
        initialCentroidsRef.current = centroids;
        centroidKeyRef.current = cacheKey;
      }
      result = kMeans(pts, k, normKey, initialCentroidsRef.current);
      paramsDesc = `k=${k}`;
    } else {
      const eps = Math.max(0.0001, parseFloat(epsInput));
      const minPts = Math.max(1, parseInt(minPtsInput, 10));
      result = dbscan(pts, eps, minPts, normKey);
      paramsDesc = `eps=${eps}, minPts=${minPts}`;
    }

    /* Append new run */
    setRuns((prev) => [
      ...prev,
      {
        id: runId,
        dataset: datasetKey,
        method: methodKey,
        paramsDesc,
        norm: normKey,
        points: result,
        visible: true,
        colorSeed: prev.length % COLORS.length,
        offsetIndex: prev.length % 9, // 0-8
      },
    ]);
    setWarning(""); // clear warning on successful add
  };

  /* ───────── Handler: toggle visibility ───────── */
  const toggleRunVisibility = (id: string) => {
    setRuns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r))
    );
  };

  /* ───────── Handler: delete a run ───────── */
  const deleteRun = (id: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
  };

  /* Runs to show in chart – filter by dataset */
  const visibleRuns = runs.filter((r) => r.dataset === datasetKey && r.visible);

  /* ───────── RENDER ───────── */
  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        bgcolor: "#e9e9e9",
        borderRadius: 6,
        border: "2px solid #0b2538",
        width: "1300px",
        mx: "auto",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <MenuBookIcon fontSize="large" />
        <Typography variant="h6">Advanced Lesson</Typography>
      </Stack>
      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <Typography variant="body2" gutterBottom>
          This interactive playground lets you experiment with clustering
          algorithms on two toy datasets: Gaussian blobs and concentric circles.
          Select either K-Means or DBSCAN, choose a distance metric (L1, L2, or
          L∞), and adjust parameters like the number of clusters (k), ε
          (radius), and MinPts. Click “Confirm & Run” to perform clustering and
          visualize results. Each run is saved in the panel below, where you can
          toggle its visibility or delete it to compare different configurations
          side by side.
        </Typography>
      </Alert>

      <Box sx={{ display: "flex", gap: 3, minHeight: 560 }}>
        {/* ─────────── Sidebar ─────────── */}
        <Stack spacing={3} width={240}>
          {/* Dataset picker */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Dataset
            </Typography>
            <ToggleButtonGroup
              value={datasetKey}
              exclusive
              onChange={(_, v) => v && setDatasetKey(v)}
              fullWidth
              size="small"
            >
              <ToggleButton value="dataset1">Dataset&nbsp;1</ToggleButton>
              <ToggleButton value="dataset2">Dataset&nbsp;2</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Method picker */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Method
            </Typography>
            <ToggleButtonGroup
              value={methodKey}
              exclusive
              onChange={(_, v) => v && setMethodKey(v)}
              fullWidth
              size="small"
            >
              <ToggleButton value="KMeans">K-Means</ToggleButton>
              <ToggleButton value="DBSCAN">DBSCAN</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Metric picker */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Distance Metric
            </Typography>
            <ToggleButtonGroup
              value={normKey}
              exclusive
              onChange={(_, v) => v && setNormKey(v)}
              fullWidth
              size="small"
            >
              <ToggleButton value="L1">L1</ToggleButton>
              <ToggleButton value="L2">L2</ToggleButton>
              <ToggleButton value="L∞">L∞</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Parameter controls */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Parameters
            </Typography>
            {methodKey === "KMeans" ? (
              <TextField
                label="Number of Clusters (k)"
                type="number"
                value={kInput}
                onChange={(e) => setKInput(e.target.value)}
                inputProps={{ min: 1 }}
                size="small"
                fullWidth
              />
            ) : (
              <Stack spacing={2}>
                <TextField
                  label="ε (radius)"
                  type="number"
                  value={epsInput}
                  onChange={(e) => setEpsInput(e.target.value)}
                  inputProps={{ min: 0, step: 0.1 }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="MinPts"
                  type="number"
                  value={minPtsInput}
                  onChange={(e) => setMinPtsInput(e.target.value)}
                  inputProps={{ min: 1 }}
                  size="small"
                  fullWidth
                />
              </Stack>
            )}
          </Box>

          {/* Run button */}
          <Button variant="contained" onClick={handleRun} sx={{ mt: 1 }}>
            Confirm&nbsp;&amp;&nbsp;Run
          </Button>
        </Stack>

        {/* ─────────── Chart & Filter Panel ─────────── */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "row", gap: 2 }}>
          {/* Chart Panel */}
          <Paper
            elevation={6}
            sx={{
              flex: 1,
              p: 2,
              borderRadius: 2,
              border: "2px solid #102338",
              backgroundColor: "#fafafa",
            }}
          >
            <Typography variant="subtitle1" gutterBottom>
              {currentDataset.name}
            </Typography>
            <Box sx={{ width: "100%" }}>
              <ResponsiveContainer width="100%" aspect={1}>
                <ComposedChart
                  margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" domain={["auto", "auto"]} />
                  <YAxis type="number" dataKey="y" domain={["auto", "auto"]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Legend />

                  {/* The raw dataset points (grey) for reference */}
                  <Scatter name="Raw" data={currentDataset.points} fill="#9e9e9e" />

                  {/* Render each visible run */}
                  {visibleRuns.map((run) => {
                    const clusters = splitIntoClusters(run.points);
                    const seed = run.colorSeed;
                    return Array.from(clusters.entries()).map(([cid, pts], idx) => (
                      <Scatter
                        key={`${run.id}-${cid}`}
                        name={`${run.method}${cid === -1 ? "-noise" : "-C" + cid} (${run.paramsDesc}, ${run.norm})`}
                        data={pts.map((p) => jitterPoint(p, run.offsetIndex))}
                        fill={cid === -1 ? "#616161" : COLORS[(seed + idx) % COLORS.length]}
                        fillOpacity={0.8}
                      />
                    ));
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Filter Panel – now on the right */}
          <Paper
            elevation={4}
            sx={{
              width: 260,
              p: 2,
              borderRadius: 2,
              border: "2px solid #102338",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Filter (max 3)
            </Typography>
            {/* Warning message */}
            {warning && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {warning}
              </Alert>
            )}
            <Stack
              spacing={1}
              divider={<Box sx={{ borderBottom: "1px dotted #9e9e9e" }} />}
              sx={{ overflowY: "auto" }}
            >
              {runs
                .filter((r) => r.dataset === datasetKey)
                .map((run) => (
                  <Stack
                    key={run.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Checkbox
                      checked={run.visible}
                      onChange={() => toggleRunVisibility(run.id)}
                      sx={{ p: 0.5 }}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                      {`${run.method} (${run.paramsDesc}, ${run.norm})`}
                    </Typography>
                    <IconButton size="small" onClick={() => deleteRun(run.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              {runs.filter((r) => r.dataset === datasetKey).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No saved results yet.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Paper>
  );
};

export default AdvancedLesson;

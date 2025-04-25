import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Snackbar,
  Alert,
  Collapse,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";

/**
 * IntroductoryLesson – purely‑frontend interactive exercise (no backend)
 * -------------------------------------------------------------------
 * ‣ Colour‑palette (left): click a swatch to select the active colour.
 * ‣ Scatter plot (right): click a dot to fill it with the active colour.
 * ‣ Refresh: clears all colours **without** regenerating a new scatter.
 * ‣ Confirm: validates the grouping locally and highlights incorrect points.
 *   – Correctly grouped points keep the learner‑chosen colour and are **not**
 *     altered (per 2025‑04 enhancement request).
 *   – Incorrect points are over‑filled with a soft red and outlined in deep red
 *     so the learner can easily focus on mistakes.
 *
 * ✨ Enhancement (2025‑04)
 * -----------------------
 * 1. Result Banner – Persistent banner summarising the score.
 * 2. Correct points retain their colour – only errors are visually flagged.
 * 3. Snackbar retained *only* for form‑completion errors.
 * 4. 🎉 New: "Congratulations" snackbar appears on full success, then triggers
 *           the optional onComplete callback after a short delay.
 *
 * 🆕 2025‑04‑23 Update
 * -------------------
 * • Removed the white swatch from the palette – learners now have exactly three
 *   colours to choose from. An unfilled point is represented internally by
 *   `null` (still displayed as white because of the SVG background), but users
 *   can no longer explicitly pick white.
 *
 * 🆕 2025‑04‑23 Plan‑B Update (deterministic scatter & gentle refresh)
 * ------------------------------------------------------------------
 * • The scatter of points is generated **once** with a deterministic seed so it
 *   remains identical every time the lesson mounts. The Refresh button now
 *   clears colours instead of regenerating a new scatter.
 *
 * 🆕 2025‑04‑23‑B2 Update (10 points & clearer clusters)
 * -----------------------------------------------------
 * • Scatter now contains only **10** points to reduce cognitive load.
 * • PULL factor increased so clusters are tighter and visually obvious.
 */

// ——————————————————————————————————————————————————————————————
// 🎨 Palette – three cluster colours only (no white)
// ——————————————————————————————————————————————————————————————
const paletteColours = [
  "#e74c3c", // red
  "#f1c40f", // yellow
  "#2e7d32", // green
] as const;

// Improved visual‑feedback colours
const INCORRECT_FILL = "#ffcdd2"; // soft red   (fill)
const INCORRECT_STROKE = "#b71c1c"; // deep red  (outline)

interface Point {
  id: number;
  x: number; // svg‑space
  y: number; // svg‑space
  colour: string | null;
  clusterId: number; // the (hidden) cluster this point belongs to
  isCorrect?: boolean; // set after validation
}

// ——————————————————————————————————————————————————————————————
// Deterministic pseudo‑random generator (Mulberry32)
// ——————————————————————————————————————————————————————————————
const mulberry32 = (a: number) => {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ——————————————————————————————————————————————————————————————
// k‑means helpers (seed‑aware)
// ——————————————————————————————————————————————————————————————
/** Clamp value into [min,max] */
const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/**
 * Run an ultra‑light k‑means (Lloyd) algorithm.
 * Returns the final centres.
 */
const runKMeans = (
  pts: { x: number; y: number }[],
  k: number,
  iters = 8,
  rnd: () => number = Math.random,
) => {
  // randomly pick k distinct points as initial centres
  let centres = [...pts]
    .sort(() => 0.5 - rnd())
    .slice(0, k)
    .map((p) => ({ ...p }));

  for (let t = 0; t < iters; t++) {
    // assignment step – bucket sums
    const buckets: { sumX: number; sumY: number; cnt: number }[] = Array.from(
      { length: k },
      () => ({ sumX: 0, sumY: 0, cnt: 0 }),
    );

    pts.forEach((p) => {
      let closest = 0,
        bestD = Infinity;
      centres.forEach((c, idx) => {
        const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        if (d < bestD) {
          closest = idx;
          bestD = d;
        }
      });
      buckets[closest].sumX += p.x;
      buckets[closest].sumY += p.y;
      buckets[closest].cnt += 1;
    });

    // update centres (recompute mean of each bucket)
    centres = centres.map((c, i) =>
      buckets[i].cnt
        ? {
            x: buckets[i].sumX / buckets[i].cnt,
            y: buckets[i].sumY / buckets[i].cnt,
          }
        : c,
    );
  }
  return centres;
};

// ——————————————————————————————————————————————————————————————
// point generator – seed‑aware version
// ——————————————————————————————————————————————————————————————

const CLUSTER_COUNT = 3; // k in k‑means ⇢ matches number of palette colours
const PULL = 0.6; // stronger pull to make clusters tighter & clearer

const generatePoints = (
  n = 10, // reduced to 10 points
  k = CLUSTER_COUNT,
  rnd: () => number = Math.random,
): Point[] => {
  // drawable region (avoid drawing right on axes)
  const X_MIN = 50,
    X_MAX = 430;
  const Y_MIN = 50,
    Y_MAX = 270;

  // 1) throw n completely random points inside viewport
  const raw: { x: number; y: number }[] = Array.from({ length: n }, () => ({
    x: rnd() * (X_MAX - X_MIN) + X_MIN,
    y: rnd() * (Y_MAX - Y_MIN) + Y_MIN,
  }));

  // 2) run k‑means to find centres
  const centres = runKMeans(raw, k, 8, rnd);

  // 3) strongly pull each point toward its centre so clusters look tighter
  const points: Point[] = raw.map((p, id) => {
    // find nearest centre index
    let cluster = 0,
      bestD = Infinity;
    centres.forEach((c, idx) => {
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < bestD) {
        cluster = idx;
        bestD = d;
      }
    });

    const cx = centres[cluster].x;
    const cy = centres[cluster].y;

    const x = clamp(p.x + (cx - p.x) * PULL, X_MIN, X_MAX);
    const y = clamp(p.y + (cy - p.y) * PULL, Y_MIN, Y_MAX);

    return { id, x, y, colour: null, clusterId: cluster };
  });

  return points;
};

// Pre‑compute a deterministic scatter once (seed = 20250423)
const INITIAL_POINTS = generatePoints(10, CLUSTER_COUNT, mulberry32(20250423));

// ——————————————————————————————————————————————————————————————
// IntroductoryLesson component (frontend‑only)
// ——————————————————————————————————————————————————————————————

interface IntroductoryLessonProps {
  /** Triggered when all points are successfully grouped; optional */
  onComplete?: () => void;
}

const IntroductoryLesson: React.FC<IntroductoryLessonProps> = ({
  onComplete,
}) => {
  const [selectedColour, setSelectedColour] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>(() => INITIAL_POINTS);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  // 🎉 congratulations snackbar state
  const [congratsOpen, setCongratsOpen] = useState(false);

  // Persistent result banner state
  const [result, setResult] = useState<{
    attempted: boolean;
    success: boolean;
    correctCount: number;
  }>({ attempted: false, success: false, correctCount: 0 });

  // ——— helpers ————————————————————————————————
  /**
   * Validate current colour assignment.
   * A point is considered *correct* when:
   *   – every point in the same hidden cluster has the *same* chosen colour; AND
   *   – no point from a *different* cluster shares that colour.
   */
  const evaluate = (
    pts: Point[],
  ): { updated: Point[]; correctCount: number } => {
    const updated = pts.map((p) => {
      if (!p.colour) return { ...p, isCorrect: false };

      const sameClusterConsistent = pts.every(
        (q) =>
          q.clusterId !== p.clusterId || // ignore other clusters
          q.colour === p.colour, // within cluster colours must match
      );

      const noOtherClusterSharesColour = pts.every(
        (q) =>
          q.clusterId === p.clusterId || // ignore same cluster
          q.colour !== p.colour, // other clusters must *not* share the colour
      );

      return {
        ...p,
        isCorrect: sameClusterConsistent && noOtherClusterSharesColour,
      };
    });

    const correctCount = updated.filter((p) => p.isCorrect).length;
    return { updated, correctCount };
  };

  // ——— event handlers ————————————————————————————————
  const handlePointClick = (id: number) => {
    if (!selectedColour) return; // ignore clicks when no swatch is active
    setPoints((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, colour: selectedColour, isCorrect: undefined } : p,
      ),
    );
  };

  /** Refresh now simply clears colours & evaluation state. */
  const handleRefresh = () => {
    setSelectedColour(null);
    setPoints((prev) =>
      prev.map((p) => ({ ...p, colour: null, isCorrect: undefined })),
    );
    setResult({ attempted: false, success: false, correctCount: 0 });
  };

  const handleConfirm = () => {
    // Ensure all points are filled before validating
    if (points.some((p) => !p.colour)) {
      setSnackbar({
        open: true,
        message: "Please colour every point first!",
        severity: "error",
      });
      return;
    }

    const { updated, correctCount } = evaluate(points);
    setPoints(updated);

    const allCorrect = correctCount === points.length;

    setResult({ attempted: true, success: allCorrect, correctCount });

    if (allCorrect) {
      setCongratsOpen(true); // show congratulations
      // delay navigation so user can read the message
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 2500);
    }
  };

  // ——— render ————————————————————————————————————————
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
      {/* header */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <MenuBookIcon fontSize="large" />
        <Typography variant="h6">Introductory lesson </Typography>
      </Stack>

      {/* explanation block */}
      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          What is this exercise about?
        </Typography>
        <Typography variant="body2" gutterBottom>
          In this short clustering warm‑up you will colour <strong>every</strong> dot on
          the scatter‑plot so that your colouring exactly matches the three hidden
          clusters (red, yellow, and green). There are <strong>exactly three</strong> clusters
          in total – no more, no less – so you will need to assign <strong>one unique
          colour</strong> to each cluster.
        </Typography>
        <Typography variant="body2" gutterBottom>
          The rules are simple:
        </Typography>
        <ul style={{ paddingLeft: 16, marginTop: 0, marginBottom: 8 }}>
          <li style={{ fontSize: "0.875rem" }}>
            All points that belong to the <em>same</em> hidden cluster&nbsp;<strong>must</strong> share
            the <em>same</em> palette colour.
          </li>
          <li style={{ fontSize: "0.875rem" }}>
            Points from <em>different</em> clusters&nbsp;<strong>cannot</strong> share colours (one
            palette colour per cluster).
          </li>
        </ul>
        <Typography variant="body2" gutterBottom>
          To begin, click a colour swatch in the palette on the left – the palette
          contains <strong>exactly three</strong> colours to match the three clusters. Then click
          each dot to paint it. When every dot has a colour, press&nbsp;
          <strong>“Confirm”</strong>. The lesson will instantly check your grouping,
          mark any mis‑coloured dots with a soft red overlay, and show your score in
          the banner below. Once <strong>all 10 dots</strong> are correctly grouped, a
          congratulatory message will appear and the lesson will automatically
          progress to the next activity.
        </Typography>
        <Typography variant="body2">
          Need to start over? Use the&nbsp;<strong>“Refresh”</strong>&nbsp;button to clear
          your colours – the scatter‑plot itself never changes, so you can focus on
          improving your cluster assignments.
        </Typography>
      </Alert>

      {/* main body */}
      <Stack direction="row" spacing={4}>
        {/* control column */}
        <Stack spacing={2} alignItems="center">
          <Button variant="outlined" fullWidth onClick={handleRefresh}>
            Refresh
          </Button>

          {/* palette */}
          <Box
            sx={{
              border: "2px solid #0b2538",
              borderRadius: 2,
              overflow: "hidden",
              width: 80,
            }}
          >
            {paletteColours.map((c) => (
              <Box
                key={c}
                sx={{
                  height: 32,
                  bgcolor: c,
                  cursor: "pointer",
                  outline:
                    selectedColour === c ? "3px solid #000" : "1px solid #0b2538",
                }}
                onClick={() => setSelectedColour(c)}
              />
            ))}
          </Box>

          <Button variant="contained" fullWidth onClick={handleConfirm}>
            Confirm
          </Button>
        </Stack>

        {/* scatter plot area */}
        <Box sx={{ flex: 1 }}>
          <svg
            width="100%"
            viewBox="0 0 480 320"
            style={{ border: "2px solid #0b2538", background: "#fff" }}
          >
            {/* axes */}
            <defs>
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="10"
                refX="0"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#0b2538" />
              </marker>
            </defs>
            <line
              x1="40"
              y1="280"
              x2="440"
              y2="280"
              stroke="#0b2538"
              strokeWidth="2"
              markerEnd="url(#arrow)"
            />
            <line
              x1="40"
              y1="280"
              x2="40"
              y2="40"
              stroke="#0b2538"
              strokeWidth="2"
              markerEnd="url(#arrow)"
            />

            {/* data points */}
            {points.map((p) => {
              const evaluated = p.isCorrect !== undefined;
              const isIncorrect = evaluated && !p.isCorrect;

              const fillColour = isIncorrect
                ? INCORRECT_FILL // highlight mistakes
                : p.colour ?? "#ffffff"; // otherwise keep user colour or white

              const strokeColour = isIncorrect ? INCORRECT_STROKE : "#000";
              const strokeWidth = isIncorrect ? 4 : 2;

              return (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r="8"
                  fill={fillColour}
                  stroke={strokeColour}
                  strokeWidth={strokeWidth}
                  onClick={() => handlePointClick(p.id)}
                  style={{ cursor: selectedColour ? "pointer" : "default" }}
                />
              );
            })}
          </svg>
        </Box>
      </Stack>

      {/* persistent result banner */}
      <Collapse in={result.attempted} sx={{ mt: 3 }}>
        <Alert
          severity={result.success ? "success" : "warning"}
          variant="filled"
          icon={false}
          sx={{ fontWeight: 600, justifyContent: "center" }}
        >
          {result.success
            ? "All points correctly grouped! 🎉"
            : `${result.correctCount}/${points.length} points correctly grouped. Keep adjusting.`}
        </Alert>
      </Collapse>

      {/* form‑completion snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* congratulations snackbar */}
      <Snackbar
        open={congratsOpen}
        autoHideDuration={2500}
        onClose={() => setCongratsOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" sx={{ width: "100%" }}>
          Congratulations! You've successfully grouped all points! 🎉
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default IntroductoryLesson;

import React, { useState, useEffect, Fragment, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Alert,
  Snackbar,
  Collapse,
  Card,
  CardContent,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  ComposedChart,
  Scatter,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// KaTeX for beautifully-rendered LaTeX mathematics
import "katex/dist/katex.min.css";
import { BlockMath, InlineMath } from "react-katex";

/**
 * IntermediateLesson – K-Means & DBSCAN Tutorial
 * Adjusted so that every section keeps a fixed size without scrollbars and
 * the coordinate axes appear slightly smaller.
 */

const NAV_ITEMS = ["Dataset", "Method", "Metrics"] as const;

// ──────────── NEW CONSTANTS ────────────
/** Fixed height for each content panel so the size never changes while toggling */
const SECTION_HEIGHT = 1040; // px – matches the previous minHeight to avoid layout shift

/** Proportional shrink factor applied to chart width so the axes look smaller. */
const CHART_WIDTH_PERCENT = "95%"; // 100 % → 90 %
const  CHART_WIDTH_PERCENT2  = "80%";

// ───────────────────────────────────────

// ... (rest of the imports and constant definitions remain unchanged)

type Section = (typeof NAV_ITEMS)[number];
interface IntermediateLessonProps {
  /** Called by parent when user completes all quiz levels */
  onComplete?: () => void;
}
// ... existing type declarations

type MethodKey = "KMeans" | "DBSCAN";

type DatasetKey = "dataset1" | "dataset2";

type NormKey = "L1" | "L2" | "L∞";

interface Point {
  x: number;
  y: number;
}
interface Cluster {
  points: Point[];
}
// 放到文件顶部附近
const PointTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  // Display only Scatter point coordinates
  const point = payload.find((p: any) => p.payload?.x !== undefined);
  if (!point) return null;

  const { x, y } = point.payload;

  return (
    <Card elevation={4} sx={{ bgcolor: 'rgba(255,255,255,0.95)', borderRadius: 2 }}>
      <CardContent sx={{ py: 1, px: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
          Coordinates
        </Typography>
        <Typography variant="body2" color="text.secondary">
          x: <strong>{x}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          y: <strong>{y}</strong>
        </Typography>
      </CardContent>
    </Card>
  );
};

const KMEANS_CONTENT = (
  <Fragment>
    <Typography variant="subtitle2" gutterBottom>
      K-Means Overview
    </Typography>
    <Typography variant="h5" gutterBottom sx={{ pl: 2 }}>
      • K-Means is an <strong>unsupervised</strong> clustering algorithm that
      partitions data points into <InlineMath math="k" /> clusters.
    </Typography>
    <Typography variant="h5" gutterBottom sx={{ pl: 2 }}>
      • It groups data points by repeatedly assigning each point to the
      nearest cluster centroid—typically measured with Euclidean distance—and
      updating centroid positions until convergence.
    </Typography>
    <Typography
      variant="h5"
      gutterBottom
      sx={{ pl: 2, color: "#d32f2f", fontWeight: 700 }}
    >
      • Users <em>must manually select</em> the number of clusters (
      <InlineMath math="k" />) <em>in advance</em>, which directly influences
      the clustering outcome.
    </Typography>
    <Typography
      variant="h5"
      gutterBottom
      sx={{ pl: 2, color: "#d32f2f", fontWeight: 700 }}
    >
      • Users can <em>define the distance metric</em> (e.g., L2, L1), and this
      choice shapes the resulting cluster boundaries.
    </Typography>
  </Fragment>
);

/**
 * ▼▼▼  EXPANDED & PARAM-HIGHLIGHTED DBSCAN CONTENT  ▼▼▼
 */
const DBSCAN_CONTENT = (
  <Box>
    {/* Heading */}
    <Typography variant="subtitle2" gutterBottom>
      DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
    </Typography>

    {/* Main bullet list */}
    <Box component="ul" sx={{ pl: 3, m: 0, listStyle: "disc" }}>
      <Typography component="li" variant="h5" gutterBottom>
        DBSCAN is a <strong>density-based</strong> clustering algorithm that
        groups together points packed closely (high-density regions) and marks
        points in sparse regions as outliers.
      </Typography>

      <Typography component="li" variant="h5" gutterBottom>
        Unlike K-Means, DBSCAN {" "}
        <strong>does not require the number of clusters</strong> (
        <InlineMath math="k" />) to be specified beforehand and can discover
        clusters of varying shapes.
      </Typography>

      <Typography component="li" variant="h5" gutterBottom>
        It identifies <em>core points</em>—points that have enough neighbors
        within a radius—and expands clusters by recursively visiting
        density-reachable points.
      </Typography>

      {/* Hyper-parameter subsection */}
      <Typography component="li" variant="h5" gutterBottom>
        Two <strong style={{ color: "#d32f2f" }}>user-tunable</strong>{" "}
        hyper-parameters control what DBSCAN considers “dense enough”:
        <Box
          component="ul"
          sx={{
            pl: 3,
            mt: 1,
            listStyle: "circle",
            color: "#d32f2f",
            fontWeight: 700,
          }}
        >
          <Typography component="li" variant="h5" gutterBottom>
            <InlineMath math="\varepsilon" /> (<code>eps</code>): neighborhood
            radius around a point
          </Typography>
          <Typography component="li" variant="h5" gutterBottom>
            MinPoints (<InlineMath math="\text{MinPts}" />
            ): minimum neighbors within <InlineMath math="\varepsilon" /> to
            qualify a point as <em>core</em>
          </Typography>
        </Box>
      </Typography>

      <Typography component="li" variant="h5" gutterBottom>
        Choosing <InlineMath math="\varepsilon" /> and MinPoints well is
        critical; practitioners often use a <em>k-distance plot</em> to find a
        knee point that balances noise removal and cluster granularity.
      </Typography>

      <Typography component="li" variant="h5" gutterBottom>
        <strong>Pros:</strong> detects arbitrary-shaped clusters, handles
        noise automatically.
      </Typography>

      <Typography component="li" variant="h5" gutterBottom>
        <strong>Cons:</strong> struggles with clusters of varying density and
        high-dimensional data where distance metrics become less meaningful.
      </Typography>
    </Box>
  </Box>
);
/** Generate uniformly‑spaced circle boundary points */
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

/** Keeps inline math vertically centered relative to adjacent text. */
const MathInline: React.FC<{ formula: string }> = ({ formula }) => (
  <Box
    component="span"
    sx={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <InlineMath math={formula} />
  </Box>
);

// ────────────────── Fixed EXAMPLE points ──────────────────
const P1 = { x: 1, y: 2 } as const;
const P2 = { x: 4, y: 6 } as const;
const HIGHLIGHT = "#1976d2";

// ────────── Helper to compute distances ──────────
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

const IntermediateLesson: React.FC<IntermediateLessonProps> = ({
  onComplete,
}) => {
  const [active, setActive] = useState<Section>("Dataset");
  const [datasetKey, setDatasetKey] = useState<DatasetKey>("dataset1");
  const [methodKey, setMethodKey] = useState<MethodKey>("KMeans");
  const [normKey, setNormKey] = useState<NormKey>("L1");

  /** ────────────── Quiz state ────────────── */
  const [unlockedNorms, setUnlockedNorms] = useState<NormKey[]>(["L1"]);
  const [quizInputs, setQuizInputs] = useState<Record<NormKey, string>>({
    L1: "",
    L2: "",
    "L∞": "",
  });
  const [correctFlags, setCorrectFlags] = useState<Record<NormKey, boolean>>({
    L1: false,
    L2: false,
    "L∞": false,
  });
  const [attemptedFlags, setAttemptedFlags] = useState<
    Record<NormKey, boolean>
  >({ L1: false, L2: false, "L∞": false });
  const tolerance = 1e-2; // Accept answers within ±0.01

  const [result, setResult] = useState<{
    attempted: boolean;
    success: boolean;
    correctCount: number;
  }>({ attempted: false, success: false, correctCount: 0 });
  const [congratsOpen, setCongratsOpen] = useState(false);

  // 每次 correctFlags 变化时，更新 result；全部正确时弹出提示并触发 onComplete
  useEffect(() => {
    const count = Object.values(correctFlags).filter((v) => v).length;
    const allOk = count === Object.keys(correctFlags).length;
    if (Object.values(attemptedFlags).some((v) => v)) {
      setResult({ attempted: true, success: allOk, correctCount: count });
      if (allOk) {
        setCongratsOpen(true);
        setTimeout(() => {
          setCongratsOpen(false);
          onComplete?.();
        }, 2500);
      }
    }
  }, [correctFlags, attemptedFlags, onComplete]);

  // ────────── Metric‑specific quiz point pairs ──────────
  const QUIZ_POINTS = useMemo<Record<NormKey, { A: Point; B: Point }>>(
    () => ({
      L1: { A: { x: 2, y: 5 }, B: { x: 6, y: 1 } },
      L2: { A: { x: 3, y: 3 }, B: { x: 7, y: 6 } },
      "L∞": { A: { x: 0, y: 2 }, B: { x: 4, y: 5 } },
    }),
    []
  );

  const handleQuizSubmit = (key: NormKey) => {
    const userVal = parseFloat(quizInputs[key]);
    if (Number.isNaN(userVal)) return;
    const truth = calcDistance(QUIZ_POINTS[key].A, QUIZ_POINTS[key].B, key);
    const isOk = Math.abs(userVal - truth) <= tolerance;
    setCorrectFlags((prev) => ({ ...prev, [key]: isOk }));
    setAttemptedFlags((prev) => ({ ...prev, [key]: true }));
    if (isOk) {
      if (key === "L1" && !unlockedNorms.includes("L2"))
        setUnlockedNorms((prev) => [...prev, "L2"]);
      if (key === "L2" && !unlockedNorms.includes("L∞"))
        setUnlockedNorms((prev) => [...prev, "L∞"]);
    }
  };

  // ────────── Datasets ──────────
  const DATASETS = useMemo(
    () => ({
      dataset1: {
        name: "Gaussian Blobs",
        description:
          "Two well‑separated Gaussian‑like blobs that illustrate simple, convex clusters.",
        clusters: [
          { points: generateCirclePoints(1, 1, 1.2, 60) },
          { points: generateCirclePoints(5, 5, 1.2, 60) },
        ] as Cluster[],
      },
      dataset2: {
        name: "Concentric Circles",
        description:
          "Concentric rings sharing a centroid but differing in radius, representing non‑linear cluster structure.",
        clusters: [
          { points: generateCirclePoints(0, 0, 1.5, 120) },
          { points: generateCirclePoints(0, 0, 3, 120) },
        ] as Cluster[],
      },
    }),
    []
  );

  const currentDataset = DATASETS[datasetKey];

  // ────────── Worked‑example distances ──────────
  const EXAMPLE_DISTANCES = useMemo<Record<NormKey, number>>(
    () => ({
      L1: calcDistance(P1, P2, "L1"),
      L2: calcDistance(P1, P2, "L2"),
      "L∞": calcDistance(P1, P2, "L∞"),
    }),
    []
  );

  // ────────── Metric formulae (KaTeX) ──────────
  const NORM_FORMULAE: Record<NormKey, string> = {
    L2: "d((x_{1},y_{1}),(x_{2},y_{2})) = \\sqrt{(x_{1} - x_{2})^{2} + (y_{1} - y_{2})^{2}}",
    L1: "d((x_{1},y_{1}),(x_{2},y_{2})) = |x_{1} - x_{2}| + |y_{1} - y_{2}|",
    "L∞": "d((x_{1},y_{1}),(x_{2},y_{2})) = \\max\\bigl(|x_{1} - x_{2}|,\\,|y_{1} - y_{2}|\\bigr)",
  };

  const NORM_DESCRIPTIONS: Record<NormKey, string> = {
    L1: "L1 (Manhattan) distance sums absolute coordinate differences.",
    L2: "L2 (Euclidean) distance is the straight‑line length between points.",
    "L∞": "L∞ (Chebyshev) distance takes the maximum absolute coordinate difference.",
  };

  // ────────── Pre‑computed line‑segment paths for illustration ──────────
  const NORM_PATHS = useMemo<
    Record<NormKey, { pts: Point[]; stroke: string }[]>
  >(() => {
    const deep = HIGHLIGHT;
    const light = "rgba(25,118,210,0.35)";
    const mid: Point = { x: P2.x, y: P1.y }; // (4,2)
    const lenHor = Math.abs(P2.x - P1.x);
    const lenVer = Math.abs(P2.y - P1.y);
    const [stroke1, stroke2] = lenHor >= lenVer ? [deep, light] : [light, deep];

    return {
      L2: [{ pts: [P1, P2], stroke: deep }],
      L1: [
        { pts: [P1, mid], stroke: deep },
        { pts: [mid, P2], stroke: deep },
      ],
      "L∞": [
        { pts: [P1, mid], stroke: stroke1 },
        { pts: [mid, P2], stroke: stroke2 },
      ],
    };
  }, []);

  // ────────── Content blocks for Method section ──────────
  // ... (KMEANS_CONTENT and DBSCAN_CONTENT unchanged)

  // ────────── Quiz UI component ──────────
  const QuizBlock: React.FC<{ norm: NormKey }> = ({ norm }) => {
    const { A, B } = QUIZ_POINTS[norm];
    const isCorrect = correctFlags[norm];
    const attempted = attemptedFlags[norm];
    const disabledInput = isCorrect;
    const nextLabel = norm === "L1" ? "L2" : norm === "L2" ? "L∞" : null;

    return (
      <Stack spacing={2} sx={{ mt: 2, width: 280 }}>
        <Typography variant="subtitle2">Practice Question ({norm})</Typography>
        <Typography variant="body2">
          Compute {norm} distance between Q<sub>1</sub> = ({A.x},{A.y}) and Q
          <sub>2</sub> = ({B.x},{B.y}).
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            label="Your answer"
            variant="outlined"
            value={quizInputs[norm]}
            onChange={(e) =>
              setQuizInputs((prev) => ({ ...prev, [norm]: e.target.value }))
            }
            disabled={disabledInput}
          />
          <Button
            variant="contained"
            onClick={() => handleQuizSubmit(norm)}
            disabled={disabledInput || quizInputs[norm].trim() === ""}
          >
            Check
          </Button>
        </Stack>
        {isCorrect && (
          <Alert severity="success">
            Correct! {nextLabel && `You can now explore the ${nextLabel} metric.`}
          </Alert>
        )}
        {attempted && !isCorrect && (
          <Alert severity="error">
            Incorrect distance calculation. Please try again!
          </Alert>
        )}
      </Stack>
    );
  };

  // ────────── RENDER SECTIONS ──────────
  const renderSection = (section: Section) => {
    switch (section) {
      case "Dataset":
        return (
          <Box sx={{ width: 1, height: SECTION_HEIGHT, overflow: "hidden" }}>
            {/* Dataset section content */}
            <Typography variant="h5" gutterBottom>
              Interactive Dataset Playground
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <ToggleButtonGroup
              value={datasetKey}
              exclusive
              onChange={(_, v) => v && setDatasetKey(v)}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="dataset1">Dataset 1</ToggleButton>
              <ToggleButton value="dataset2">Dataset 2</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="subtitle1" gutterBottom>
              {currentDataset.name}
            </Typography>
            <Typography variant="h5" paragraph sx={{ pl: 2 }}>
              {currentDataset.description}
            </Typography>
            <Box sx={{ width: 1 }}>
              {/* CHART SHRUNK TO 90 % WIDTH */}
              <ResponsiveContainer width={CHART_WIDTH_PERCENT2} aspect={1}>
                <ComposedChart
                  margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* Smaller‑looking axes via fontSize */}
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip content={<PointTooltip />} />
                  {currentDataset.clusters.map((c, idx) => (
                    <Scatter key={idx} data={c.points} name={`Cluster ${idx + 1}`} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        );

      case "Method":
        return (
          <Box sx={{ width: 1, height: SECTION_HEIGHT, overflow: "hidden" }}>
            {/* Method section content */}
            <Typography variant="h5" gutterBottom>
              Clustering Algorithms
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <ToggleButtonGroup
              value={methodKey}
              exclusive
              onChange={(_, v) => v && setMethodKey(v)}
              sx={{ mb: 3 }}
            >
              <ToggleButton value="KMeans">K-Means</ToggleButton>
              <ToggleButton value="DBSCAN">DBSCAN</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ width: 1, pr: 1 }}>{methodKey === "KMeans" ? KMEANS_CONTENT : DBSCAN_CONTENT}</Box>
          </Box>
        );

      case "Metrics":
        return (
          <Box sx={{ width: 1, height: SECTION_HEIGHT, overflow: "hidden" }}>
            {/* Metrics section content */}
            <Typography variant="h5" gutterBottom>
              Distance Metrics – Geometric Illustration
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <ToggleButtonGroup
              value={normKey}
              exclusive
              onChange={(_, v) => v && setNormKey(v)}
              sx={{ mb: 3 }}
            >
              <ToggleButton value="L1">L1</ToggleButton>
              <ToggleButton value="L2" disabled={!unlockedNorms.includes("L2")}>L2</ToggleButton>
              <ToggleButton value="L∞" disabled={!unlockedNorms.includes("L∞")}>L∞</ToggleButton>
            </ToggleButtonGroup>
            <Stack spacing={1} sx={{ maxWidth: 640, mb: 3 }}>
              <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                {NORM_DESCRIPTIONS[normKey]}
              </Typography>
              <BlockMath math={NORM_FORMULAE[normKey]} />
              <Typography variant="h5">
                <strong>Worked example:</strong> Let P<sub>1</sub> = (1, 2), P<sub>2</sub> = (4, 6). Then
                <InlineMath math={`d(P_{1},P_{2}) = ${EXAMPLE_DISTANCES[normKey].toFixed(3)}`} />
              </Typography>
            </Stack>
            <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ width: 1 }}>
                  {/* Chart shrunk to 90 % */}
                  <ResponsiveContainer width={CHART_WIDTH_PERCENT} aspect={1}>
                    <ComposedChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[0, 7]}
                        ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        domain={[0, 7]}
                        ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip content={<PointTooltip />} />
                      {/* Points */}
                      <Scatter name="Points" data={[P1, P2]} fill="#d32f2f" />
                      {/* Norm‑specific paths */}
                      {NORM_PATHS[normKey].map((seg, idx) => (
                        <Line key={idx} data={seg.pts} dataKey="y" stroke={seg.stroke} strokeWidth={3} dot={false} tooltipType="none"  legendType="none"  />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
              <QuizBlock norm={normKey} />
            </Box>
          </Box>
        );
      default:
        return null;
    }
  };

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
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <MenuBookIcon fontSize="large" />
        <Typography variant="h6">Intermediate Lesson</Typography>
      </Stack>
      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <Typography variant="body2" gutterBottom>
          This interactive lesson guides you through the fundamentals of clustering algorithms: explore different datasets, compare K-Means and DBSCAN methods, and practice computing distance metrics with hands-on examples and quizzes.
        </Typography>
      </Alert>

      <Box sx={{ display: "flex", gap: 3 }}>
        <Stack spacing={3} width={170}>
          {NAV_ITEMS.map((item) => (
            <Button
              key={item}
              variant={active === item ? "contained" : "outlined"}
              onClick={() => setActive(item)}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                fontSize: "1rem",
                borderWidth: 2,
                borderColor: "#102338",
                backgroundColor: active === item ? "#d4e0ff" : "rgba(255,255,255,0.6)",
                color: "#102338",
                ":hover": { backgroundColor: "#d4e0ff" },
              }}
            >
              {item}
            </Button>
          ))}
        </Stack>
        {/* Removed overflowY:auto to eliminate scrollbars */}
        <Paper
          elevation={6}
          sx={{
            flex: 1,
            p: 3,
            borderRadius: 2,
            border: "2px solid #102338",
            backgroundColor: "#fafafa",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {renderSection(active)}
          <Collapse in={result.attempted} sx={{ mt: 3 }}>
            <Alert
              severity={result.success ? "success" : "warning"}
              variant="filled"
              icon={false}
              sx={{ fontWeight: 600, justifyContent: "center" }}
            >
              {result.success
                ? "All metrics correctly answered! 🎉"
                : `${result.correctCount}/3 metrics correct. Keep going.`}
            </Alert>
          </Collapse>

          {/* 🎉 新增：Congratulations Snackbar */}
          <Snackbar
            open={congratsOpen}
            autoHideDuration={2500}
            onClose={() => setCongratsOpen(false)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert severity="success" variant="filled" sx={{ width: "100%" }}>
              Congratulations! You've successfully completed this lesson! 🎉
            </Alert>
          </Snackbar>
        </Paper>
      </Box>
    </Paper>
  );
};

export default IntermediateLesson;

import React, { useState } from "react";
import { Container, Box, Button, Stack, Typography } from "@mui/material";
import IntroductoryLesson from "./IntroductoryLesson";
import IntermediateLesson from "./IntermediateLesson";
import AdvancedLesson from "./AdvancedLesson";

export type LessonKey = "intro" | "intermediate" | "advanced";

const App: React.FC = () => {
  const [activeLesson, setActiveLesson] = useState<LessonKey>("intro");

  /** Render the lesson corresponding to the current selection */
  const renderLesson = () => {
    switch (activeLesson) {
      case "intro":
        return (
          <IntroductoryLesson onComplete={() => setActiveLesson("intermediate")} />
        );
        case "intermediate":
          return (
            <IntermediateLesson onComplete={() => setActiveLesson("advanced")} />
          );
      case "advanced":
        return <AdvancedLesson />;
      default:
        return null;
    }
  };

  return (
    <Container maxWidth={false} sx={{ mt: 4 }}>
      {/* Title */}
      <Typography variant="h4" align="center" gutterBottom>
        Learning Tool of Clustering
      </Typography>

      {/* Top horizontally aligned buttons */}
      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          variant={activeLesson === "intro" ? "contained" : "outlined"}
          onClick={() => setActiveLesson("intro")}
        >
          Introductory lesson
        </Button>
        <Button
          variant={activeLesson === "intermediate" ? "contained" : "outlined"}
          onClick={() => setActiveLesson("intermediate")}
        >
          Intermediate lesson
        </Button>
        <Button
          variant={activeLesson === "advanced" ? "contained" : "outlined"}
          onClick={() => setActiveLesson("advanced")}
        >
          Advanced lesson
        </Button>
      </Stack>

      {/* Lesson content area */}
      <Box sx={{ mt: 1 }}>{renderLesson()}</Box>
    </Container>
  );
};

export default App;

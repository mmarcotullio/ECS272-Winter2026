import VisOne from "../visualizations/VisOne";
import VisTwo from "../visualizations/VisTwo";
import VisThree from "../visualizations/VisThree";

export default function VisualizationStack() {
  console.log("VisualizationStack rendered");

  return (
    <div>
      <VisOne />
      <VisTwo />
      <VisThree />
    </div>
  );
}


import { useEffect, useRef } from "react";
import { renderOzoneHeatMap } from "../d3/VisTwo";

export default function VisTwo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    renderOzoneHeatMap(container);

    return () => {
    };
  }, []);

  return (
    <div style={{ marginBottom: "40px", textAlign: "center" }}>
      <h2>Global Ozone Layer Thickness (Heat Map)</h2>
      <p style={{ 
        fontSize: "0.9em", 
        color: "#666",
        maxWidth: "800px",
        margin: "0 auto 20px auto"
      }}>
        Color represents Ozone Thickness in Dobson Units (DU). 
        Red indicates lower thickness (ozone depletion risk), while Blue indicates healthier levels.
      </p>
      <div 
        ref={ref} 
        style={{ 
          width: "100%", 
          height: "500px", 
          background: "#ffffff",
          display: "flex",
          justifyContent: "center" 
        }}
      ></div>
    </div>
  );
}
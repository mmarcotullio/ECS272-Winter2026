import { useEffect, useRef } from "react";
import { renderGlobalPopulationGrowth } from "../d3/VisOne";

export default function VisOne() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    renderGlobalPopulationGrowth(container);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div style={{ marginBottom: "40px", textAlign: "center" }}>
      <h2>Population Growth</h2>
      <p style={{ 
        fontSize: "0.9em", 
        color: "#666",
        maxWidth: "800px",
        margin: "0 auto 20px auto"
      }}>
        Top ten countries labeled in legend.
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
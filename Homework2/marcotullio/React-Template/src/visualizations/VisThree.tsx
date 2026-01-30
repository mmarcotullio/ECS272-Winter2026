import { useEffect, useRef } from "react";
import { renderTop3PopRadar } from "../d3/VisThree";

export default function VisThree() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    
    renderTop3PopRadar(container);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div style={{ marginBottom: "40px", textAlign: "center" }}>
      <h2>Risk Profiles</h2>
      <p style={{ 
        fontSize: "0.9em", 
        color: "#666",
        maxWidth: "800px",
        margin: "0 auto 20px auto"
      }}>
        Comparing resource and supply chain pressures for Brazil, Canada, and the United States (2025 data). 
        Values are normalized relative to global maximums.
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
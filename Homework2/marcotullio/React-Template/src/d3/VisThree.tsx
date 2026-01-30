import * as d3 from "d3";

type DataRow = {
  country: string;
  year: number;
  population: number;
  food_demand_index: number;
  water_consumption_per_capita: number;
  energy_demand_index: number;
  inflation_rate: number;
  supply_chain_disruption_index: number;
  resource_dependency_score: number;
};

const METRICS = [
  { key: "food_demand_index", label: "Food Demand", max: 100 },
  { key: "energy_demand_index", label: "Energy Demand", max: 100 },
  { key: "supply_chain_disruption_index", label: "Supply Chain", max: 100 },
  { key: "resource_dependency_score", label: "Resource Dep.", max: 100 },
  { key: "water_consumption_per_capita", label: "Water Cons.", max: "auto" },
  { key: "inflation_rate", label: "Inflation", max: "auto" }
];

export async function renderTop3PopRadar(container: HTMLElement) {
  const margin = { top: 40, right: 100, bottom: 50, left: 100 };
  const width = 1150 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const chartRadius = 100;
  const spacing = 300; 

  const svg = d3.select(container)
    .selectAll("svg.vis-three-svg")
    .data([null])
    .join(
      enter => enter.append("svg")
        .attr("class", "vis-three-svg")
        .attr("width", width)
        .attr("height", height),
      update => update
        .attr("width", width)
        .attr("height", height)
    );

  svg.selectAll("*").remove();

  const rawData = await d3.csv("/data/global_pop_pressure/population_goods_resources.csv", (d) => ({
    country: d.country!,
    year: +d.year!,
    population: +d.population!,
    food_demand_index: +d.food_demand_index!,
    water_consumption_per_capita: +d.water_consumption_per_capita!,
    energy_demand_index: +d.energy_demand_index!,
    inflation_rate: +d.inflation_rate!,
    supply_chain_disruption_index: +d.supply_chain_disruption_index!,
    resource_dependency_score: +d.resource_dependency_score!
  })) as DataRow[];

  const countryGroups = d3.group(rawData, d => d.country);
  
  const countryStats = Array.from(countryGroups).map(([country, records]) => {
    records.sort((a, b) => b.year - a.year); 
    const latest = records[0];
    return {
      country,
      population: latest.population,
      food_demand_index: latest.food_demand_index,
      inflation_rate: latest.inflation_rate,
      latestRecord: latest
    };
  });

  const displayCountries = ["United States", "Brazil", "Canada"]
  const countriesOfInterest = countryStats.filter(c => displayCountries.includes(c.country));

  const maxWater = d3.max(rawData, d => d.water_consumption_per_capita) || 100;
  const maxInflation = d3.max(rawData, d => d.inflation_rate) || 20;

  const axesConfig = METRICS.map(m => ({
    ...m,
    maxValue: m.max === "auto" 
      ? (m.key === "water_consumption_per_capita" ? maxWater : maxInflation)
      : m.max as number
  }));

  const rScale = d3.scaleLinear().range([0, chartRadius]).domain([0, 1]);
  const angleSlice = (Math.PI * 2) / axesConfig.length;

  countriesOfInterest.forEach((item, i) => {
    const centerX = margin.left + chartRadius + (i * spacing);
    const centerY = height / 2;

    const g = svg.append("g")
      .attr("transform", `translate(${centerX}, ${centerY})`);

    g.append("text")
      .attr("x", 0)
      .attr("y", -chartRadius - 60)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text(item.country);
      
    g.append("text")
      .attr("x", 0)
      .attr("y", -chartRadius - 35)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(`Pop: ${item.population} `);

    const levels = 4;
    for (let level = 1; level <= levels; level++) {
      const levelFactor = level / levels;
      g.selectAll(".levels")
        .data(axesConfig)
        .enter()
        .append("line")
        .attr("x1", (d, j) => rScale(levelFactor) * Math.cos(angleSlice * j - Math.PI / 2))
        .attr("y1", (d, j) => rScale(levelFactor) * Math.sin(angleSlice * j - Math.PI / 2))
        .attr("x2", (d, j) => rScale(levelFactor) * Math.cos(angleSlice * (j + 1) - Math.PI / 2))
        .attr("y2", (d, j) => rScale(levelFactor) * Math.sin(angleSlice * (j + 1) - Math.PI / 2))
        .style("stroke", "#CDCDCD")
        .style("stroke-dasharray", "3,3");
    }

    const axis = g.selectAll(".axis")
      .data(axesConfig)
      .enter()
      .append("g")
      .attr("class", "axis");

    axis.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, j) => rScale(1.1) * Math.cos(angleSlice * j - Math.PI / 2))
      .attr("y2", (d, j) => rScale(1.1) * Math.sin(angleSlice * j - Math.PI / 2))
      .style("stroke", "gray")
      .style("stroke-width", "1px");

    axis.append("text")
      .style("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("x", (d, j) => rScale(1.25) * Math.cos(angleSlice * j - Math.PI / 2))
      .attr("y", (d, j) => rScale(1.25) * Math.sin(angleSlice * j - Math.PI / 2))
      .text(d => d.label);

    const radarData = [...axesConfig, axesConfig[0]];

    const linePath = d3.lineRadial<any>()
      .radius(d => {
        const key = d.key as keyof DataRow;
        const val = item.latestRecord[key] as number;
        const normalized = Math.max(0, val / d.maxValue); 
        return rScale(normalized);
      })
      .angle((d, j) => j * angleSlice);

    g.append("path")
      .datum(radarData)
      .attr("d", linePath)
      .style("fill", "rgba(54, 162, 235, 0.5)")
      .style("stroke", "rgb(54, 162, 235)")
      .style("stroke-width", 2);

    g.selectAll(".value-label")
      .data(axesConfig)
      .enter()
      .append("text")
      .attr("class", "value-label")
      .attr("x", (d, j) => {
        const key = d.key as keyof DataRow;
        const val = item.latestRecord[key] as number;
        const normalized = Math.max(0, val / d.maxValue);
        const posRadius = rScale(normalized) + 12; 
        return posRadius * Math.cos(angleSlice * j - Math.PI / 2);
      })
      .attr("y", (d, j) => {
        const key = d.key as keyof DataRow;
        const val = item.latestRecord[key] as number;
        const normalized = Math.max(0, val / d.maxValue);
        const posRadius = rScale(normalized) + 12;
        return posRadius * Math.sin(angleSlice * j - Math.PI / 2);
      })
      .text(d => {
        const key = d.key as keyof DataRow;
        const val = item.latestRecord[key] as number;
        return val < 10 ? val.toFixed(1) : Math.round(val).toString();
      })
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle");
  });
}
import * as d3 from "d3";

type Row = {
  country: string;
  year: number;
  population: number;
};

/**
 * Render the Global Population Growth chart (1960–2025)
 * @param container A div element passed from React
 */
export async function renderGlobalPopulationGrowth(container: HTMLDivElement) {

  const margin = { top: 40, right: 100, bottom: 50, left: 100 };
  const width = 950 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = d3.select(container)
    .selectAll("svg.viz-one-svg")
    .data([null])
    .join(
      (enter) => enter.append("svg")
        .attr("class", "viz-one-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom),
      (update) => update
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    );


  const data: Row[] = await d3.csv("/data/global_pop_pressure/population_growth.csv", (d) => ({
    country: d.country!,
    year: +d.year!,
    population: +d.population!
  })) as Row[];


  const series = d3.group(data, (d) => d.country);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(data, (d) => d.year) as [number, number])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.population)!])
    .nice()
    .range([height, 0]);

  const color = d3.scaleOrdinal<string>()
    .domain([...series.keys()])
    .range(d3.schemeTableau10);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g")
    .call(d3.axisLeft(y));

  // Axis labels
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text("Year");

  g.append("text")
    .attr("x", -height / 2)
    .attr("y", -50)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Population (millions)");

  // Line generator
  const line = d3.line<Row>()
    .x((d) => x(d.year))
    .y((d) => y(d.population));

// Draw lines for ONLY the first 10 countries
  Array.from(series.keys()).slice(0, 10).forEach((country) => {
    const values = series.get(country);
    if (!values) return;

    g.append("path")
      .datum(values)
      .attr("fill", "none")
      .attr("stroke", color(country))
      .attr("stroke-width", 3)
      .attr("d", line);
  });
// Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width + margin.left + 10}, ${margin.top})`);

  Array.from(series.keys()).slice(0, 10).forEach((country, i) => {
    const yPos = i * 20;
    legend.append("rect")
      .attr("x", 0)
      .attr("y", yPos)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", color(country));
    legend.append("text")
      .attr("x", 18)
      .attr("y", yPos + 10)
      .text(country)
      .attr("font-size", 12);
  });

  return svg.node()!;
}
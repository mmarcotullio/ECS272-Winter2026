import * as d3 from "d3";

type OzoneData = {
  country: string;
  year: number;
  ozone_thickness: number;
};

type GeoFeature = {
  type: "Feature";
  properties: {
    name: string;
  };
  geometry: any;
};

// Dictionary for mismatch country names between JSOn and dataset
const countryNameMapping: Record<string, string> = {
  "United States": "USA",
  "United Kingdom": "England",
  "Russia": "Russian Federation",
  "Tanzania": "United Republic of Tanzania",
  "Congo": "Republic of the Congo",
  "Democratic Republic of the Congo": "Democratic Republic of the Congo",
  "Vietnam": "Viet Nam",
  "Laos": "Lao PDR",
  "South Korea": "South Korea",
  "North Korea": "North Korea",
  "Syria": "Syrian Arab Republic",
  "Moldova": "Republic of Moldova",
  "Bolivia": "Bolivia",
  "Venezuela": "Venezuela",
  "Iran": "Iran",
  "Serbia": "Republic of Serbia",
  "Guinea-Bissau": "Guinea Bissau",
  "Czech Republic": "Czech Republic",
  "Macedonia": "The former Yugoslav Republic of Macedonia",
  "Brunei": "Brunei Darussalam",
  "Palestinian Territories": "Palestine",
  "Timor-Leste": "East Timor"
};

export async function renderOzoneHeatMap(container: HTMLElement) {
  const margin = { top: 40, right: 100, bottom: 50, left: 100 };
  const width = 950 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = d3.select(container)
    .selectAll("svg.vis-two-svg")
    .data([null])
    .join(
      (enter) => enter.append("svg")
        .attr("class", "vis-two-svg")
        .attr("width", width)
        .attr("height", height),
      (update) => update
        .attr("width", width)
        .attr("height", height)
    );

  svg.selectAll("*").remove();

  const [data, geoData] = await Promise.all([
    d3.csv("/data/global_pop_pressure/population_ozone_environment.csv", (d) => ({
      country: d.country!,
      year: +d.year!,
      ozone_thickness: +d.ozone_thickness!
    })),
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
  ]);

  const csvData = data as OzoneData[];
  const worldMap = geoData as { features: GeoFeature[] };

  const latestYear = d3.max(csvData, d => d.year) || 1970;
  const yearData = csvData.filter(d => d.year === latestYear);

  const dataMap = new Map<string, number>();

  yearData.forEach((d) => {
    let cleanName = d.country;
    
    if (countryNameMapping[cleanName]) {
      cleanName = countryNameMapping[cleanName];
    }

    dataMap.set(cleanName, d.ozone_thickness);
  });

  const ozoneExtent = d3.extent(yearData, d => d.ozone_thickness) as [number, number];
  
  const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateSpectral)
    .domain(ozoneExtent);

  const projection = d3.geoNaturalEarth1()
    .scale(width / 1.3 / Math.PI)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  const g = svg.append("g");

  g.selectAll("path")
    .data(worldMap.features)
    .join("path")
    .attr("d", path as any)
    .attr("fill", (d) => {
      const value = dataMap.get(d.properties.name);
      return value ? colorScale(value) : "#e0e0e0"; 
    })

  // Legend
  drawLegend(svg, colorScale, ozoneExtent, width, height);
}

function drawLegend(svg: any, colorScale: any, domain: [number, number], width: number, height: number) {
  const legendWidth = 200;
  const legendHeight = 10;
  
  const legend = svg.append("g")
    .attr("transform", `translate(${width - legendWidth - 20}, ${height - 40})`);

  const defs = svg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "linear-gradient");

  linearGradient.selectAll("stop")
    .data(d3.range(0, 1.1, 0.1))
    .join("stop")
    .attr("offset", (d: number) => `${d * 100}%`)
    .attr("stop-color", (d: number) => colorScale(domain[0] + d * (domain[1] - domain[0])));

  legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#linear-gradient)");

  legend.append("text")
    .attr("x", 0)
    .attr("y", -5)
    .text(Math.round(domain[0]).toString())
    .style("font-size", "10px");
    
  legend.append("text")
    .attr("x", legendWidth)
    .attr("y", -5)
    .attr("text-anchor", "end")
    .text(Math.round(domain[1]).toString())
    .style("font-size", "10px");

  legend.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .text("Ozone (DU)")
    .style("font-size", "12px")
    .style("font-weight", "bold");
}
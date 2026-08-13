// Rasterize a live <svg> element to a JPEG data-URI so a rendered sample chart
// can be sent to /api/score exactly like an uploaded image. The SVG must style
// itself with presentation attributes (fill="#…", stroke="…") rather than CSS
// classes — external stylesheets do not apply once the SVG is serialized here.
export async function svgToDataUri(svg: SVGSVGElement): Promise<string> {
  const vb = svg.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : svg.clientWidth || 800;
  const height = vb && vb.height ? vb.height : svg.clientHeight || 600;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgDataUri =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 2x upscale keeps axis labels legible for the vision model.
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to rasterize SVG"));
    img.src = svgDataUri;
  });
}

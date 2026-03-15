/**
 * Fetch an image URL and return a base64 data URL.
 * SVGs are rasterized to PNG via canvas for html-to-image compatibility.
 */
export async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";
    const blob = await res.blob();

    // For SVGs: rasterize to PNG via canvas
    if (contentType.includes("svg") || url.endsWith(".svg")) {
      return await svgToPngDataUrl(blob);
    }

    // For raster images: convert directly
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function svgToPngDataUrl(blob: Blob): Promise<string> {
  const svgText = await blob.text();
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Use a large size for quality
      canvas.width = img.naturalWidth || 400;
      canvas.height = img.naturalHeight || 400;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(svgDataUrl); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(svgDataUrl);
    img.src = svgDataUrl;
  });
}

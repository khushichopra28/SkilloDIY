const CARD_WIDTH = 430;
const CARD_HEIGHT = 680;
const EXPORT_SCALE = 3;

function encode(value: string) {
  return new TextEncoder().encode(value);
}

function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'Handler-ID';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function waitForCardAssets(svg: SVGSVGElement) {
  if ('fonts' in document) await document.fonts.ready;
  const hrefs = Array.from(svg.querySelectorAll('image')).map((image) => image.getAttribute('href') || image.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).filter((href): href is string => Boolean(href));
  await Promise.all(hrefs.map(async (href) => {
    const image = new Image();
    if (!href.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.src = href;
    if (typeof image.decode === 'function') await image.decode();
    else await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Profile photo could not be prepared for export.')); });
  }));
}

async function renderCard(svg: SVGSVGElement) {
  await waitForCardAssets(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(CARD_WIDTH));
  clone.setAttribute('height', String(CARD_HEIGHT));
  clone.removeAttribute('class');
  clone.style.background = '#f6fbfa';

  const markup = new XMLSerializer().serializeToString(clone);
  const source = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = source;
    if (typeof image.decode === 'function') await image.decode();
    else await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('The ID card could not be rendered for export.')); });

    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH * EXPORT_SCALE;
    canvas.height = CARD_HEIGHT * EXPORT_SCALE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot create the ID card image.');
    context.fillStyle = '#f6fbfa';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(EXPORT_SCALE, EXPORT_SCALE);
    context.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    return canvas;
  } finally {
    URL.revokeObjectURL(source);
  }
}

function canvasPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The PNG file could not be generated.')), 'image/png'));
}

function canvasJpeg(canvas: HTMLCanvasElement) {
  const encoded = canvas.toDataURL('image/jpeg', 0.96).split(',')[1];
  if (!encoded) throw new Error('The PDF image could not be generated.');
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createPdf(jpeg: Uint8Array, pixelWidth: number, pixelHeight: number) {
  // CR80 portrait card size, 54 × 85.6 mm, embedded without stretching.
  const widthPt = (54 / 25.4) * 72;
  const heightPt = (85.6 / 25.4) * 72;
  const content = encode(`q\n${widthPt.toFixed(3)} 0 0 ${heightPt.toFixed(3)} 0 0 cm\n/ID Do\nQ\n`);
  const objectBodies = [
    encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(3)} ${heightPt.toFixed(3)}] /Resources << /XObject << /ID 4 0 R >> >> /Contents 5 0 R >>`),
    concat([encode(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, encode('\nendstream')]),
    concat([encode(`<< /Length ${content.length} >>\nstream\n`), content, encode('endstream')]),
  ];
  const parts: Uint8Array[] = [encode('%PDF-1.4\n% EventOps ID\n')];
  const offsets = [0];
  let offset = parts[0].length;
  for (let index = 0; index < objectBodies.length; index += 1) {
    offsets.push(offset);
    const object = concat([encode(`${index + 1} 0 obj\n`), objectBodies[index], encode('\nendobj\n')]);
    parts.push(object);
    offset += object.length;
  }
  const xrefOffset = offset;
  const xref = `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((item) => `${String(item).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(encode(xref));
  return new Blob([concat(parts)], { type: 'application/pdf' });
}

export async function downloadIdCard(svg: SVGSVGElement, handlerId: string, format: 'png' | 'pdf') {
  const canvas = await renderCard(svg);
  const filenameBase = `EventOps-Handler-ID-${safeId(handlerId)}`;
  if (format === 'png') {
    triggerDownload(await canvasPng(canvas), `${filenameBase}.png`);
    return;
  }
  triggerDownload(createPdf(canvasJpeg(canvas), canvas.width, canvas.height), `${filenameBase}.pdf`);
}

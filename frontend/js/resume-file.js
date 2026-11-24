// Reads an uploaded resume file into plain text, in the browser. Nothing is sent to WILSY.
// PDF: Mozilla's pdf.js, loaded from cdnjs the first time a PDF is chosen (the file itself stays here).
// Word (.docx): unzipped with the browser's own DecompressionStream. Text and Markdown: read as is.

export const RESUME_FILE_MAX = 5 * 1024 * 1024;
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168';
const PDF_PAGES = 10;

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');

/** One file out of a zip archive (stored or deflated), or null when it is not there. */
export async function unzipEntry(buffer, name) {
  const bytes = new Uint8Array(buffer), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for(let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if(view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if(end < 0) throw new Error('This file is not a Word document.');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const text = new TextDecoder();
  for(let n = 0; n < count && at + 46 <= bytes.length; n++) {
    if(view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true), entry = text.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if(entry === name) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      if(method === 0) return text.decode(data);
      if(method !== 8) throw new Error('This Word document uses a compression the browser can’t read.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    at += 46 + nameLength + extra + comment;
  }
  return null;
}

/** The text of a .docx file, one paragraph per line. */
export async function docxText(buffer) {
  const xml = await unzipEntry(buffer, 'word/document.xml');
  if(xml == null) throw new Error('This file is not a Word document.');
  return decode(xml.replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>|<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

async function pdfText(buffer) {
  const pdfjs = await import(`${PDFJS}/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({data: new Uint8Array(buffer), isEvalSupported: false}).promise;
  const pages = [];
  for(let p = 1; p <= Math.min(pdf.numPages, PDF_PAGES); p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    pages.push(content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
  }
  await pdf.destroy();
  return pages.join('\n').replace(/[ \t]+/g, ' ').trim();
}

/** The text of a resume file: PDF, Word (.docx) or plain text. Throws a readable message otherwise. */
export async function readResumeFile(file) {
  if(!file) throw new Error('Choose a file first.');
  if(file.size > RESUME_FILE_MAX) throw new Error('That file is larger than 5 MB. Save a smaller copy of your resume and try again.');
  const name = String(file.name || '').toLowerCase();
  if(name.endsWith('.doc')) throw new Error('Older .doc files can’t be read here. Save your resume as PDF or .docx and upload that.');
  let text;
  if(name.endsWith('.pdf') || file.type === 'application/pdf') text = await pdfText(await file.arrayBuffer());
  else if(name.endsWith('.docx')) text = await docxText(await file.arrayBuffer());
  else if(/\.(txt|md|text)$/.test(name) || file.type.startsWith('text/')) text = await file.text();
  else throw new Error('Upload a PDF, a Word (.docx) file or a text file.');
  if(!text || text.replace(/\s/g, '').length < 40) throw new Error('No text could be read from this file. If it is a scanned image, paste your resume text instead.');
  return text;
}

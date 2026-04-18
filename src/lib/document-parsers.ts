// Browser-side text extraction for PDF, DOCX, XLSX
// Lazy/dynamic imports to avoid loading pdfjs-dist during SSR (it requires DOMMatrix).
import mammoth from "mammoth";
import * as XLSX from "xlsx";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing only available in the browser");
  }
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const lib = await import("pdfjs-dist");
      // Use CDN worker matching the installed pdfjs-dist version to avoid
      // bundler ?url imports that break TanStack's route crawler.
      const version = (lib as any).version || "4.7.76";
      lib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
      return lib;
    })();
  }
  return pdfjsLibPromise;
}

export type ParsedDoc = {
  text: string;
  pages: number;
  kind: "pdf" | "docx" | "xlsx" | "unknown";
};

export async function parsePdf(file: File): Promise<ParsedDoc> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str).join(" ");
    text += `\n\n[PÁGINA ${i}]\n${pageText}`;
  }
  return { text: text.trim(), pages: pdf.numPages, kind: "pdf" };
}

export async function parseDocx(file: File): Promise<ParsedDoc> {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return { text: value, pages: 1, kind: "docx" };
}

export async function parseXlsx(file: File): Promise<ParsedDoc> {
  const data = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(data, { type: "array" });
  let text = "";
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws);
    text += `\n\n[ABA: ${name}]\n${csv}`;
  });
  return { text: text.trim(), pages: wb.SheetNames.length, kind: "xlsx" };
}

export async function parseDocument(file: File): Promise<ParsedDoc> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return parsePdf(file);
  if (ext === "docx" || ext === "doc") return parseDocx(file);
  if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
  return { text: "", pages: 0, kind: "unknown" };
}

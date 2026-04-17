// Browser-side text extraction for PDF, DOCX, XLSX
import * as pdfjsLib from "pdfjs-dist";
// Bundle the worker locally via Vite (?url) — avoids CDN/version mismatch failures
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ParsedDoc = {
  text: string;
  pages: number;
  kind: "pdf" | "docx" | "xlsx" | "unknown";
};

export async function parsePdf(file: File): Promise<ParsedDoc> {
  const data = new Uint8Array(await file.arrayBuffer());
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

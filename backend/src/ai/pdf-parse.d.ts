declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export default pdfParse;
}

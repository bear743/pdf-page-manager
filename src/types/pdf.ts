export type PDFFile = {
  id: string;
  file: File;
  pageCount: number;
  thumbnails: (string | null)[];
  pageNames: string[];
  isLoading: boolean;
  isMerging?: boolean;
};

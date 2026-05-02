export type Mode = "merge" | "custom-split" | "fixed-split";

export type PDFFile = {
  id: string;
  file: File;
  pageCount: number;
  thumbnails: string[];
  pageNames: string[];
  isLoading: boolean;
  isMerging?: boolean;
};

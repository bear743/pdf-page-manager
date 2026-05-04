export type PDFFile = {
  id: string;
  file: File;
  pageCount: number;
  thumbnails: (string | null)[];
  pageNames: string[];
  originalPageNumbers: number[];
  isLoading: boolean;
  isMerging?: boolean;
  isSplitting?: boolean;
  isDeleting?: boolean;
  isReordering?: boolean;
};

export type DragMode = "reorder" | "merge" | null;

export interface MergeTarget {
  fileId: string;
  pageIndex: number;
  side: "left" | "right";
}

export function getInsertIndex(x: number, y: number): number {
  const cards = Array.from(
    document.querySelectorAll("[data-file-id]:not([data-thumbnail-target])"),
  ) as HTMLElement[];
  if (cards.length === 0) return 0;

  const items = cards.map((card, i) => ({
    index: i,
    rect: card.getBoundingClientRect(),
  }));

  const rows: typeof items[] = [];
  const yTolerance = 30;

  for (const item of items) {
    let placed = false;
    for (const row of rows) {
      if (Math.abs(item.rect.top - row[0].rect.top) < yTolerance) {
        row.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([item]);
  }

  for (const row of rows) {
    row.sort((a, b) => a.rect.left - b.rect.left);
  }
  rows.sort((a, b) => a[0].rect.top - b[0].rect.top);

  let targetRow = rows[0];
  let minRowDist = Infinity;

  for (const row of rows) {
    const rowTop = row[0].rect.top;
    const rowBottom = Math.max(...row.map((r) => r.rect.bottom));
    const rowMid = (rowTop + rowBottom) / 2;
    const dist = Math.abs(y - rowMid);
    if (dist < minRowDist) {
      minRowDist = dist;
      targetRow = row;
    }
  }

  for (let i = 0; i < targetRow.length; i++) {
    const card = targetRow[i];
    const cardMid = (card.rect.left + card.rect.right) / 2;
    if (x < cardMid) {
      return card.index;
    }
  }

  return targetRow[targetRow.length - 1].index + 1;
}

export function getMergeTarget(
  x: number,
  y: number,
  sourceId: string,
): MergeTarget | null {
  const thumbnails = document.querySelectorAll(
    "[data-thumbnail-target]",
  ) as NodeListOf<HTMLElement>;

  for (const el of thumbnails) {
    const rect = el.getBoundingClientRect();
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      const fileId = el.getAttribute("data-file-id");
      if (!fileId || fileId === sourceId) continue;

      const pageIndex = parseInt(el.getAttribute("data-page-index") || "0");
      const side = x < (rect.left + rect.right) / 2 ? "left" : "right";

      return { fileId, pageIndex, side };
    }
  }

  return null;
}

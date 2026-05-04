export type DragMode = "reorder" | "merge" | null;

export interface MergeTarget {
  fileId: string;
  pageIndex: number;
  side: "left" | "right";
}

export function getInsertIndex(x: number, y: number): number {
  // Use elementFromPoint to find the card directly under the cursor
  // This avoids issues with row grouping when expanded cards have different heights
  const element = document.elementFromPoint(x, y);
  const card = element?.closest("[data-file-id]:not([data-thumbnail-target])") as HTMLElement | null;

  if (!card) {
    // Fallback: use bounding rect method
    const cards = Array.from(
      document.querySelectorAll("[data-file-id]:not([data-thumbnail-target])"),
    ) as HTMLElement[];
    if (cards.length === 0) return 0;

    const items = cards.map((c, i) => ({
      index: i,
      rect: c.getBoundingClientRect(),
    }));

    type Item = typeof items[number];
    const rows: Item[][] = [];
    const yTolerance = 10;

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
      const c = targetRow[i];
      const cardMid = (c.rect.left + c.rect.right) / 2;
      if (x < cardMid) {
        return c.index;
      }
    }

    return targetRow[targetRow.length - 1].index + 1;
  }

  // Find the index of the closest card before the hovered card in the DOM
  const allCards = Array.from(
    document.querySelectorAll("[data-file-id]:not([data-thumbnail-target])"),
  ) as HTMLElement[];
  const hoveredIndex = allCards.indexOf(card);

  // Get the card's bounding rect to determine if we're on the left or right side
  const rect = card.getBoundingClientRect();
  const midX = (rect.left + rect.right) / 2;

  if (x < midX) {
    // Cursor is on the left side of the hovered card
    return hoveredIndex;
  } else {
    // Cursor is on the right side of the hovered card
    return hoveredIndex + 1;
  }
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

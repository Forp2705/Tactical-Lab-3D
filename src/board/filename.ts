export type BoardFilenameOptions = {
  title: string;
  date?: string | Date;
  prefix?: string;
  extension?: "svg" | "png" | "html" | "pdf";
};

export function slugifyBoardFilenamePart(
  value: string,
  fallback = "board",
): string {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);

  return slug || fallback;
}

export function formatBoardExportDate(
  value: string | Date = new Date(),
): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function buildBoardFilename({
  title,
  date = new Date(),
  prefix = "romboiq-board",
  extension = "svg",
}: BoardFilenameOptions): string {
  const safePrefix = slugifyBoardFilenamePart(prefix, "romboiq-board");
  const safeTitle = slugifyBoardFilenamePart(title, "board");
  const safeDate = formatBoardExportDate(date);
  return `${safePrefix}-${safeTitle}-${safeDate}.${extension}`;
}

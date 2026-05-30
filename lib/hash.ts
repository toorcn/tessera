// Cheap, stable content key for caching AI metadata across re-uploads.
// Avoids reading full bytes; identity from name + size + mtime is enough here.
export function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

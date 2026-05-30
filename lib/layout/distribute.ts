// Carousel distribution: split an ordered list of photo ids across slides.

export function distribute<T>(ids: T[], perSlide: number): T[][] {
  const size = Math.max(1, Math.floor(perSlide));
  if (ids.length === 0) return [[]];
  const slides: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    slides.push(ids.slice(i, i + size));
  }
  return slides;
}

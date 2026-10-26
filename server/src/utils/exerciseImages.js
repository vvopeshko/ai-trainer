/**
 * Start/end photos of catalog exercises from Free Exercise DB (Unlicense).
 * Exercise.imageUrl keeps the source path of the first frame ('Leg_Press/0.jpg');
 * the second frame is '…/1.jpg'. Served by jsDelivr, pinned to one commit of
 * the repository so the pictures cannot change under us. Shown where an
 * exercise has no GIF.
 */
const BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/'

/** Absolute URLs of an exercise's frames: [] without a picture. */
export function exerciseImages(imageUrl) {
  if (!imageUrl) return []
  if (/^https?:\/\//.test(imageUrl)) return [imageUrl]
  const first = BASE + imageUrl
  return /\/0\.jpg$/.test(imageUrl) ? [first, BASE + imageUrl.replace(/0\.jpg$/, '1.jpg')] : [first]
}

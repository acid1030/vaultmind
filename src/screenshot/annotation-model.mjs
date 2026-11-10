export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function normalizeRect(start, end, width, height) {
  const x1 = clamp(start.x, 0, width), x2 = clamp(end.x, 0, width);
  const y1 = clamp(start.y, 0, height), y2 = clamp(end.y, 0, height);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}
export const createHistory = () => ({ items: [], future: [] });
export function appendAnnotation(history, annotation) {
  return { items: [...history.items, structuredClone(annotation)], future: [] };
}
export function undo(history) {
  if (!history.items.length) return history;
  return { items: history.items.slice(0, -1), future: [history.items.at(-1), ...history.future] };
}
export function redo(history) {
  if (!history.future.length) return history;
  return { items: [...history.items, history.future[0]], future: history.future.slice(1) };
}
export function drawAnnotation(ctx, item) {
  ctx.save();
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;
  ctx.lineWidth = item.lineWidth || 4;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (item.tool === 'rectangle') ctx.strokeRect(item.x, item.y, item.width, item.height);
  if (item.tool === 'ellipse') { ctx.beginPath(); ctx.ellipse(item.x + item.width / 2, item.y + item.height / 2, item.width / 2, item.height / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (item.tool === 'arrow') {
    const { start, end } = item;
    const angle = Math.atan2(end.y - start.y, end.x - start.x), head = Math.max(14, ctx.lineWidth * 4);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6)); ctx.closePath(); ctx.fill();
  }
  if (item.tool === 'brush') {
    if (item.points.length === 1) { ctx.beginPath(); ctx.arc(item.points[0].x, item.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); item.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke(); }
  }
  if (item.tool === 'text') {
    ctx.font = `600 ${item.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'top';
    item.text.split('\n').forEach((line, index) => ctx.fillText(line, item.x, item.y + index * item.fontSize * 1.3));
  }
  if (item.tool === 'mosaic' && item.width > 0 && item.height > 0) {
    const tile = Math.max(8, item.lineWidth * 4);
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.ceil(item.width / tile)); small.height = Math.max(1, Math.ceil(item.height / tile));
    small.getContext('2d').drawImage(ctx.canvas, item.x, item.y, item.width, item.height, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, small.width, small.height, item.x, item.y, item.width, item.height);
  }
  ctx.restore();
}

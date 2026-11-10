import { clamp, normalizeRect, createHistory, appendAnnotation, undo, redo, drawAnnotation } from './annotation-model.mjs';
const $ = selector => document.querySelector(selector);
const canvas = $('#canvas'), ctx = canvas.getContext('2d'), frame = $('#frame'), textInput = $('#text-input');
const status = $('#status');
let history = createHistory(), tool = 'rectangle', color = '#f04452', pending = null, gesture = null, textPoint = null;
let source = null, image = null, scale = 1, finishing = false;
const lineWidth = () => Number($('#line-width').value) / scale;
const fontSize = () => Number($('#font-size').value) / scale;
function message(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function render() {
  if (!image) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const item of history.items) { if (item.tool === 'clear') { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); } else drawAnnotation(ctx, item); }
  if (pending) drawAnnotation(ctx, pending);
  $('#undo').disabled = !history.items.length; $('#redo').disabled = !history.future.length;
  $('#clear').disabled = !history.items.length;
}
function resize() {
  if (!source) return;
  const bounds = $('#workspace').getBoundingClientRect();
  scale = Math.min(1, Math.max(1, bounds.width - 40) / source.width, Math.max(1, bounds.height - 40) / source.height);
  const width = source.width * scale, height = source.height * scale;
  Object.assign(frame.style, { width: `${width}px`, height: `${height}px` });
  Object.assign(canvas.style, { width: `${width}px`, height: `${height}px` });
  if (textPoint) positionText();
  $('#dimensions').textContent = `${source.width} × ${source.height} · ${Math.round(scale * 100)}%`;
}
function point(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: clamp((event.clientX - bounds.left) * canvas.width / bounds.width, 0, canvas.width), y: clamp((event.clientY - bounds.top) * canvas.height / bounds.height, 0, canvas.height) };
}
function commitText() {
  if (!textPoint) return;
  const text = textInput.value.slice(0, 2000);
  if (text.trim()) history = appendAnnotation(history, { tool: 'text', ...textPoint, text, color: textInput.dataset.color, fontSize: Number(textInput.dataset.fontSize) });
  textPoint = null; textInput.value = ''; textInput.hidden = true; render();
}
function positionText() {
  Object.assign(textInput.style, { left: `${textPoint.x * scale}px`, top: `${textPoint.y * scale}px`, color: textInput.dataset.color,
    fontSize: `${Math.max(12, Number(textInput.dataset.fontSize) * scale)}px`, maxWidth: `${Math.max(150, (source.width - textPoint.x) * scale)}px` });
}
function setTool(value) {
  commitText(); tool = value;
  document.querySelectorAll('[data-tool]').forEach(button => { button.classList.toggle('active', button.dataset.tool === value); button.setAttribute('aria-pressed', String(button.dataset.tool === value)); });
  message(value === 'text' ? '点击图片添加文字；Enter 确认，Shift+Enter 换行' : value === 'mosaic' ? '拖选需要打码的区域；可调整粗细控制马赛克颗粒' : '在图片上拖动标注；⌘/Ctrl+Z 撤销');
}
for (const button of document.querySelectorAll('[data-tool]')) button.addEventListener('click', () => setTool(button.dataset.tool));
for (const [value, name] of [['#f04452', '红色'], ['#ffd43b', '黄色'], ['#3cd08e', '绿色'], ['#39a7ff', '蓝色'], ['#ffffff', '白色'], ['#151b24', '黑色']]) {
  const button = document.createElement('button'); button.style.backgroundColor = value; button.ariaLabel = name; button.title = name;
  button.classList.toggle('active', value === color);
  button.addEventListener('click', () => { commitText(); color = value; $('#palette').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button)); });
  $('#palette').append(button);
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || finishing || !source) return;
  commitText(); const start = point(event);
  if (tool === 'text') {
    textPoint = { x: Math.min(start.x, Math.max(0, source.width - 20)), y: Math.min(start.y, Math.max(0, source.height - 20)) };
    textInput.dataset.color = color; textInput.dataset.fontSize = fontSize(); textInput.hidden = false; positionText(); textInput.focus(); return;
  }
  canvas.setPointerCapture(event.pointerId);
  gesture = { tool, start, points: [start], pointerId: event.pointerId };
  pending = null;
});
canvas.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const end = point(event), base = { tool: gesture.tool, color, lineWidth: lineWidth() };
  if (gesture.tool === 'brush') {
    const last = gesture.points.at(-1);
    if (Math.hypot(end.x - last.x, end.y - last.y) >= 1 && gesture.points.length < 10000) gesture.points.push(end);
    pending = { ...base, points: gesture.points };
  } else if (gesture.tool === 'arrow') pending = { ...base, start: gesture.start, end };
  else pending = { ...base, ...normalizeRect(gesture.start, end, source.width, source.height) };
  render();
});
function endGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  if (!pending && gesture.tool === 'brush') pending = { tool: 'brush', color, lineWidth: lineWidth(), points: gesture.points };
  if (pending && (pending.tool === 'brush' || pending.tool === 'arrow' || (pending.width > 1 && pending.height > 1))) history = appendAnnotation(history, pending);
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  gesture = null; pending = null; render();
}
canvas.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', () => { gesture = null; pending = null; render(); });
textInput.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Enter' && !event.shiftKey && !(event.metaKey || event.ctrlKey)) { event.preventDefault(); commitText(); }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); textPoint = null; textInput.hidden = true; textInput.value = ''; }
});
$('#undo').addEventListener('click', () => { commitText(); history = undo(history); render(); });
$('#redo').addEventListener('click', () => { commitText(); history = redo(history); render(); });
$('#clear').addEventListener('click', () => { commitText(); if (history.items.length) { history = appendAnnotation(history, { tool: 'clear' }); render(); } });
async function finish() {
  if (finishing || !source) return;
  commitText(); gesture = null; pending = null; render(); finishing = true; $('#finish').disabled = true;
  try { await window.screenshotApi.finish(canvas.toDataURL('image/png').split(',')[1]); }
  catch (error) { message(error.message || '无法导出标注截图', true); finishing = false; $('#finish').disabled = false; }
}
$('#finish').addEventListener('click', finish);
$('#cancel').addEventListener('click', () => window.screenshotApi.cancel());
window.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Escape') { event.preventDefault(); window.screenshotApi.cancel(); return; }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void finish(); return; }
  if (event.target.matches('textarea, input, select')) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); commitText(); history = event.shiftKey ? redo(history) : undo(history); render(); return; }
  if (!event.metaKey && !event.ctrlKey && !event.altKey) {
    const shortcuts = { r: 'rectangle', o: 'ellipse', a: 'arrow', b: 'brush', t: 'text', m: 'mosaic' };
    if (shortcuts[event.key.toLowerCase()]) { event.preventDefault(); setTool(shortcuts[event.key.toLowerCase()]); }
  }
});
new ResizeObserver(resize).observe($('#workspace'));
try {
  source = await window.screenshotApi.getSource();
  image = new Image(); image.src = source.image; await image.decode();
  canvas.width = source.width; canvas.height = source.height; resize(); setTool('rectangle'); render();
} catch (error) { message(error.message || '无法读取截图', true); $('#finish').disabled = true; }

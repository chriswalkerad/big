import '@testing-library/jest-dom/vitest'

// jsdom lacks layout, so ProseMirror's scroll-into-selection (triggered by the
// editor's edit-mode autofocus) calls `getClientRects`/`getBoundingClientRect` on
// nodes that return `undefined` under jsdom and throw. These are harmless no-ops in
// a headless environment, so provide empty-rect shims — same spirit as the
// `elementFromPoint` stub the editor tests already install.
const emptyRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON() {
    return {}
  },
} as DOMRect

const emptyRectList = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
} as unknown as DOMRectList

for (const proto of [Element.prototype, Range.prototype]) {
  if (typeof proto.getClientRects !== 'function') {
    proto.getClientRects = () => emptyRectList
  }
  if (typeof proto.getBoundingClientRect !== 'function') {
    proto.getBoundingClientRect = () => emptyRect
  }
}

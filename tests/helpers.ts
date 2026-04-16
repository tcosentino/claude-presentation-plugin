import { readFileSync } from 'fs'
import { resolve } from 'path'

export interface PresentationData {
  title: string
  sections: {
    title: string
    slides: {
      title: string
      subtitle?: string
      steps: {
        content: Record<string, unknown>[]
        narrationText?: string
        narration?: string
      }[]
    }[]
  }[]
}

export function minimalPresentationData(overrides?: Partial<PresentationData>): PresentationData {
  return {
    title: 'Test Presentation',
    sections: [
      {
        title: 'Section One',
        slides: [
          {
            title: 'Slide One',
            steps: [
              {
                content: [{ kind: 'text', text: 'Hello **world**' }],
                narrationText: 'Welcome to the presentation.',
                narration: 'slide-01-step-0.mp3',
              },
              {
                content: [{ kind: 'bullets', items: ['Point A', 'Point B'] }],
                narrationText: 'Here are some points.',
                narration: 'slide-01-step-1.mp3',
              },
            ],
          },
          {
            title: 'Slide Two',
            steps: [
              {
                content: [{ kind: 'text', text: 'Second slide content' }],
                narrationText: 'This is slide two.',
                narration: 'slide-02-step-0.mp3',
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  }
}

// Track listeners added to document so we can remove them between tests
type ListenerEntry = { type: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions }
let trackedListeners: ListenerEntry[] = []
let isPatched = false

function patchDocumentAddEventListener() {
  if (isPatched) return
  isPatched = true

  const origAdd = document.addEventListener.bind(document)
  const origRemove = document.removeEventListener.bind(document)

  document.addEventListener = function (
    type: string,
    fn: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    trackedListeners.push({ type, fn, options })
    origAdd(type, fn, options as any)
  }

  // Keep removeEventListener working normally
  document.removeEventListener = function (
    type: string,
    fn: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    trackedListeners = trackedListeners.filter(
      (entry) => !(entry.type === type && entry.fn === fn),
    )
    origRemove(type, fn, options as any)
  }

  ;(document as any).__removeAllTrackedListeners = function () {
    for (const entry of trackedListeners) {
      origRemove(entry.type, entry.fn, entry.options as any)
    }
    trackedListeners = []
  }
}

/**
 * Reset the document state between tests.
 * Removes all event listeners added by the runtime and clears the DOM.
 */
export function resetDocument() {
  // Remove all tracked event listeners
  if ((document as any).__removeAllTrackedListeners) {
    ;(document as any).__removeAllTrackedListeners()
  }

  // Clear DOM
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
  while (document.head.firstChild) document.head.removeChild(document.head.firstChild)

  window.location.hash = ''
  sessionStorage.clear()
  localStorage.clear()
  ;(window as any).PRESENTATION_DATA = undefined
  ;(window as any).__presentationReady = undefined
  ;(window as any).__presentationImageError = undefined
  ;(window as any).__onStepStart = undefined
}

/**
 * Load the presentation runtime into the current jsdom window.
 * Sets up window.PRESENTATION_DATA and a mock hljs before evaluating the script.
 */
export function loadRuntime(data: PresentationData) {
  // Patch addEventListener tracking (once per test suite)
  patchDocumentAddEventListener()

  // Mock hljs globally
  ;(window as any).hljs = {
    highlight(code: string, _opts: unknown) {
      return { value: code.replace(/</g, '&lt;').replace(/>/g, '&gt;') }
    },
  }

  // Mock Audio
  ;(window as any).Audio = class MockAudio {
    src = ''
    pause() {}
    play() { return Promise.resolve() }
    addEventListener() {}
  }

  // Mock sessionStorage and localStorage (jsdom provides these but ensure they're clean)
  sessionStorage.clear()
  localStorage.clear()

  // Mock document.fonts (jsdom does not implement FontFaceSet)
  if (!document.fonts) {
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    })
  }

  // Mock scrollIntoView (jsdom does not implement it)
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {}
  }

  // Set presentation data
  ;(window as any).PRESENTATION_DATA = data

  // Load and evaluate the runtime.
  // jsdom does not execute inline <script> content, so we use indirect eval
  // to run the IIFE in the global scope where it can access window/document.
  const runtimePath = resolve(__dirname, '..', 'runtime', 'v1', 'presentation.js')
  const runtimeCode = readFileSync(runtimePath, 'utf-8')
  // eslint-disable-next-line no-eval
  ;(0, eval)(runtimeCode)
}

/**
 * Query helper for common DOM elements created by the runtime.
 */
export function dom() {
  return {
    get progressBar() { return document.getElementById('progressBar')! },
    get sectionBadge() { return document.getElementById('sectionBadge')! },
    get headerTitle() { return document.getElementById('headerTitle')! },
    get slidePosition() { return document.getElementById('slidePosition')! },
    get slideInner() { return document.getElementById('slideInner')! },
    get slideCounter() { return document.getElementById('slideCounter')! },
    get prevBtn() { return document.getElementById('prevBtn') as HTMLButtonElement },
    get nextBtn() { return document.getElementById('nextBtn') as HTMLButtonElement },
    get audioBtn() { return document.getElementById('audioBtn')! },
    get overviewBackdrop() { return document.getElementById('overviewBackdrop')! },
    get overviewGrid() { return document.getElementById('overviewGrid')! },
    stepBlocks() { return document.querySelectorAll('.step-block') },
    visibleSteps() { return document.querySelectorAll('.step-block.visible') },
    stepDots() { return document.querySelectorAll('.step-dot') },
    overviewCards() { return document.querySelectorAll('.overview-card') },
  }
}

/**
 * Simulate a keyboard event on the document.
 */
export function pressKey(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

import { describe, it, expect, beforeEach } from 'vitest'
import { minimalPresentationData, loadRuntime, resetDocument, dom, pressKey } from './helpers'

describe('presentation runtime', () => {
  beforeEach(() => {
    resetDocument()
  })

  describe('bootstrap', () => {
    it('creates the expected DOM structure', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().progressBar).toBeTruthy()
      expect(dom().sectionBadge).toBeTruthy()
      expect(dom().headerTitle).toBeTruthy()
      expect(dom().slidePosition).toBeTruthy()
      expect(dom().slideInner).toBeTruthy()
      expect(dom().prevBtn).toBeTruthy()
      expect(dom().nextBtn).toBeTruthy()
      expect(dom().audioBtn).toBeTruthy()
      expect(dom().overviewBackdrop).toBeTruthy()
      expect(dom().overviewGrid).toBeTruthy()
    })

    it('shows the first slide on init', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().headerTitle.textContent).toBe('Slide One')
      expect(dom().sectionBadge.textContent).toBe('Section One')
      expect(dom().slidePosition.textContent).toBe('1 / 2')
    })

    it('disables prev button on first slide', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().prevBtn.disabled).toBe(true)
    })

    it('enables next button when more steps exist', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().nextBtn.disabled).toBe(false)
    })
  })

  describe('navigation', () => {
    it('advances step within a slide on next', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().visibleSteps().length).toBe(1)
      pressKey('ArrowRight')
      expect(dom().visibleSteps().length).toBe(2)
    })

    it('advances to next slide after all steps revealed', () => {
      loadRuntime(minimalPresentationData())

      // Slide 1 has 2 steps -- advance past both
      pressKey('ArrowRight') // reveal step 2
      pressKey('ArrowRight') // go to slide 2
      expect(dom().headerTitle.textContent).toBe('Slide Two')
      expect(dom().slidePosition.textContent).toBe('2 / 2')
    })

    it('goes back to previous slide on prev', () => {
      loadRuntime(minimalPresentationData())

      // Go to slide 2
      pressKey('ArrowRight')
      pressKey('ArrowRight')
      expect(dom().headerTitle.textContent).toBe('Slide Two')

      // Go back
      pressKey('ArrowLeft')
      expect(dom().headerTitle.textContent).toBe('Slide One')
    })

    it('navigates to start with Home key', () => {
      loadRuntime(minimalPresentationData())

      pressKey('ArrowRight')
      pressKey('ArrowRight')
      expect(dom().slidePosition.textContent).toBe('2 / 2')

      pressKey('Home')
      expect(dom().slidePosition.textContent).toBe('1 / 2')
    })

    it('navigates to end with End key', () => {
      loadRuntime(minimalPresentationData())

      pressKey('End')
      expect(dom().slidePosition.textContent).toBe('2 / 2')
    })

    it('disables next button on last step of last slide', () => {
      loadRuntime(minimalPresentationData())

      pressKey('End')
      expect(dom().nextBtn.disabled).toBe(true)
    })

    it('space key advances like ArrowRight', () => {
      loadRuntime(minimalPresentationData())

      pressKey(' ')
      expect(dom().visibleSteps().length).toBe(2)
    })
  })

  describe('content rendering', () => {
    it('renders text blocks with inline markdown', () => {
      loadRuntime(minimalPresentationData())

      const textEl = dom().slideInner.querySelector('.content-text')
      expect(textEl).toBeTruthy()
      // The runtime renders bold markdown as <strong> tags
      expect(textEl!.querySelector('strong')).toBeTruthy()
      expect(textEl!.querySelector('strong')!.textContent).toBe('world')
    })

    it('renders bullet lists', () => {
      loadRuntime(minimalPresentationData())

      // Reveal step 2 which has bullets
      pressKey('ArrowRight')
      const bullets = dom().slideInner.querySelectorAll('.content-bullets li')
      expect(bullets.length).toBe(2)
      expect(bullets[0].textContent).toBe('Point A')
      expect(bullets[1].textContent).toBe('Point B')
    })

    it('renders code blocks', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Code Section',
            slides: [
              {
                title: 'Code Slide',
                steps: [
                  {
                    content: [
                      { kind: 'code', language: 'typescript', code: 'const x = 1', filename: 'test.ts' },
                    ],
                    narrationText: 'Here is some code.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const codeBlock = dom().slideInner.querySelector('.code-block')
      expect(codeBlock).toBeTruthy()
      expect(codeBlock!.querySelector('.code-filename')!.textContent).toBe('test.ts')
      expect(codeBlock!.querySelector('.code-lang')!.textContent).toBe('typescript')
      expect(codeBlock!.querySelector('code')!.textContent).toContain('const x = 1')
    })

    it('renders callout blocks', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Callout Section',
            slides: [
              {
                title: 'Callout Slide',
                steps: [
                  {
                    content: [
                      { kind: 'callout', variant: 'tip', text: 'A helpful tip' },
                      { kind: 'callout', variant: 'warning', text: 'Be careful' },
                      { kind: 'callout', variant: 'info', text: 'For your information' },
                    ],
                    narrationText: 'Note these callouts.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const callouts = dom().slideInner.querySelectorAll('.callout')
      expect(callouts.length).toBe(3)
      expect(callouts[0].classList.contains('tip')).toBe(true)
      expect(callouts[1].classList.contains('warning')).toBe(true)
      expect(callouts[2].classList.contains('info')).toBe(true)
    })

    it('renders comparison blocks', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Compare Section',
            slides: [
              {
                title: 'Compare Slide',
                steps: [
                  {
                    content: [
                      {
                        kind: 'comparison',
                        left: { label: 'Before', code: 'var x = 1' },
                        right: { label: 'After', code: 'const x = 1' },
                      },
                    ],
                    narrationText: 'Compare these.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const comparison = dom().slideInner.querySelector('.comparison')
      expect(comparison).toBeTruthy()
      const labels = comparison!.querySelectorAll('.comparison-label')
      expect(labels[0].textContent).toBe('Before')
      expect(labels[1].textContent).toBe('After')
    })

    it('renders mermaid blocks as unprocessed placeholders', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Diagram Section',
            slides: [
              {
                title: 'Diagram Slide',
                steps: [
                  {
                    content: [
                      { kind: 'mermaid', diagram: 'flowchart TD\n  A --> B' },
                    ],
                    narrationText: 'A diagram.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const mermaidBlock = dom().slideInner.querySelector('.mermaid-block')
      expect(mermaidBlock).toBeTruthy()
      const mermaidDiv = mermaidBlock!.querySelector('.mermaid')
      expect(mermaidDiv).toBeTruthy()
      // Without window.mermaid, it stays as escaped text
      expect(mermaidDiv!.textContent).toContain('flowchart TD')
    })

    it('renders image blocks', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Image Section',
            slides: [
              {
                title: 'Image Slide',
                steps: [
                  {
                    content: [
                      { kind: 'image', src: 'screenshot.png', alt: 'A screenshot', caption: 'Fig 1', size: 'large', frame: true },
                    ],
                    narrationText: 'An image.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const imageBlock = dom().slideInner.querySelector('.image-block')
      expect(imageBlock).toBeTruthy()
      expect(imageBlock!.classList.contains('size-large')).toBe(true)
      expect(imageBlock!.classList.contains('no-frame')).toBe(false)
      const img = imageBlock!.querySelector('img')
      expect(img!.getAttribute('src')).toBe('screenshot.png')
      expect(img!.getAttribute('alt')).toBe('A screenshot')
      const caption = imageBlock!.querySelector('.image-caption')
      expect(caption!.textContent).toBe('Fig 1')
    })

    it('renders image block without frame when frame is false', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Image Section',
            slides: [
              {
                title: 'Image Slide',
                steps: [
                  {
                    content: [
                      { kind: 'image', src: 'icon.png', alt: 'Icon', frame: false },
                    ],
                    narrationText: 'An icon.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const imageBlock = dom().slideInner.querySelector('.image-block')
      expect(imageBlock!.classList.contains('no-frame')).toBe(true)
    })
  })

  describe('step dots', () => {
    it('renders step dots for multi-step slides', () => {
      loadRuntime(minimalPresentationData())

      const dots = dom().stepDots()
      expect(dots.length).toBe(2)
      expect(dots[0].classList.contains('active')).toBe(true)
    })

    it('updates dot state on navigation', () => {
      loadRuntime(minimalPresentationData())

      pressKey('ArrowRight')
      const dots = dom().stepDots()
      expect(dots[0].classList.contains('completed')).toBe(true)
      expect(dots[1].classList.contains('active')).toBe(true)
    })
  })

  describe('overview', () => {
    it('toggles overview on Escape', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().overviewBackdrop.classList.contains('open')).toBe(false)
      pressKey('Escape')
      expect(dom().overviewBackdrop.classList.contains('open')).toBe(true)
      pressKey('Escape')
      expect(dom().overviewBackdrop.classList.contains('open')).toBe(false)
    })

    it('renders overview cards for each slide', () => {
      loadRuntime(minimalPresentationData())

      pressKey('Escape')
      const cards = dom().overviewCards()
      expect(cards.length).toBe(2)
      expect(cards[0].classList.contains('current')).toBe(true)
    })
  })

  describe('progress bar', () => {
    it('updates progress as steps advance', () => {
      loadRuntime(minimalPresentationData())

      // 3 total steps (2 on slide 1, 1 on slide 2)
      // After init: step 1/3 = 33.3%
      const initial = parseFloat(dom().progressBar.style.width)
      expect(initial).toBeCloseTo(33.3, 0)

      pressKey('ArrowRight') // step 2/3 = 66.7%
      const after = parseFloat(dom().progressBar.style.width)
      expect(after).toBeCloseTo(66.7, 0)
    })
  })

  describe('slide counter', () => {
    it('shows current step count', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().slideCounter.textContent).toBe('Step 1 of 2')
      pressKey('ArrowRight')
      expect(dom().slideCounter.textContent).toBe('Step 2 of 2')
    })
  })

  describe('title slide detection', () => {
    it('renders a title slide for single-step text-only slides', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Intro',
            slides: [
              {
                title: 'Welcome',
                subtitle: 'A great presentation',
                steps: [
                  {
                    content: [{ kind: 'text', text: 'Let us begin' }],
                    narrationText: 'Welcome.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const titleSlide = dom().slideInner.querySelector('.title-slide')
      expect(titleSlide).toBeTruthy()
      expect(titleSlide!.querySelector('.slide-title')!.textContent).toBe('Welcome')
    })
  })

  describe('inline markdown', () => {
    it('renders bold, code, and links', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'MD Section',
            slides: [
              {
                title: 'MD Slide',
                steps: [
                  {
                    content: [{ kind: 'text', text: '**bold** and `code` and [link](https://example.com)' }],
                    narrationText: 'Markdown.',
                    narration: 'slide-01-step-0.mp3',
                  },
                  {
                    content: [{ kind: 'text', text: 'Second step' }],
                    narrationText: 'More content.',
                    narration: 'slide-01-step-1.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const textEl = dom().slideInner.querySelector('.content-text')!
      expect(textEl.querySelector('strong')!.textContent).toBe('bold')
      expect(textEl.querySelector('code')!.textContent).toBe('code')
      const link = textEl.querySelector('a')!
      expect(link.textContent).toBe('link')
      expect(link.getAttribute('href')).toBe('https://example.com')
      expect(link.getAttribute('target')).toBe('_blank')
    })
  })

  describe('position persistence', () => {
    it('saves position to URL hash', () => {
      loadRuntime(minimalPresentationData())

      pressKey('ArrowRight')
      expect(window.location.hash).toBe('#0-1')
    })

    it('saves position to sessionStorage', () => {
      loadRuntime(minimalPresentationData())

      pressKey('ArrowRight')
      expect(sessionStorage.getItem('presentation-position')).toBe('0-1')
    })
  })

  describe('audio mute', () => {
    it('persists mute state to localStorage', () => {
      loadRuntime(minimalPresentationData())

      dom().audioBtn.click()
      expect(localStorage.getItem('presentation-muted')).toBe('true')

      dom().audioBtn.click()
      expect(localStorage.getItem('presentation-muted')).toBe('false')
    })

    it('toggles muted class on audio button', () => {
      loadRuntime(minimalPresentationData())

      expect(dom().audioBtn.classList.contains('muted')).toBe(false)
      dom().audioBtn.click()
      expect(dom().audioBtn.classList.contains('muted')).toBe(true)
    })
  })

  describe('code highlighting', () => {
    it('highlights specific lines when highlight array provided', () => {
      const data = minimalPresentationData({
        sections: [
          {
            title: 'Highlight Section',
            slides: [
              {
                title: 'Highlight Slide',
                steps: [
                  {
                    content: [
                      { kind: 'code', language: 'typescript', code: 'line1\nline2\nline3', highlight: [2] },
                    ],
                    narrationText: 'Note line 2.',
                    narration: 'slide-01-step-0.mp3',
                  },
                ],
              },
            ],
          },
        ],
      })
      loadRuntime(data)

      const lines = dom().slideInner.querySelectorAll('.code-line')
      expect(lines.length).toBe(3)
      expect(lines[0].classList.contains('highlighted')).toBe(false)
      expect(lines[1].classList.contains('highlighted')).toBe(true)
      expect(lines[2].classList.contains('highlighted')).toBe(false)
    })
  })
})

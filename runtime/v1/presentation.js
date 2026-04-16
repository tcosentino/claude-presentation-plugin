(function () {
  'use strict'

  var PRESENTATION_DATA = window.PRESENTATION_DATA
  if (!PRESENTATION_DATA) {
    document.body.textContent = 'Error: window.PRESENTATION_DATA is not defined.'
    return
  }

  // ===== DOM BOOTSTRAP =====
  // Builds the shell DOM that was previously static HTML in the template.
  // All innerHTML usage renders author-controlled presentation data only.
  function bootstrap() {
    document.body.innerHTML = ''

    var progressBar = document.createElement('div')
    progressBar.className = 'progress-bar'
    progressBar.id = 'progressBar'
    document.body.appendChild(progressBar)

    var header = document.createElement('div')
    header.className = 'header'
    header.innerHTML =
      '<div class="header-left">' +
        '<span class="section-badge" id="sectionBadge"></span>' +
        '<span class="header-title" id="headerTitle"></span>' +
      '</div>' +
      '<div class="header-right">' +
        '<span id="slidePosition"></span>' +
      '</div>'
    document.body.appendChild(header)

    var slideContainer = document.createElement('div')
    slideContainer.className = 'slide-container'
    slideContainer.id = 'slideContainer'
    slideContainer.innerHTML = '<div class="slide-inner" id="slideInner"></div>'
    document.body.appendChild(slideContainer)

    var footer = document.createElement('div')
    footer.className = 'footer'
    footer.innerHTML =
      '<button class="nav-btn" id="prevBtn">' +
        '<span>&#8592;</span> Prev <kbd>&#8592;</kbd>' +
      '</button>' +
      '<div class="footer-center">' +
        '<button class="audio-btn" id="audioBtn" title="Toggle audio">' +
          '<span id="audioIcon">&#128266;</span>' +
        '</button>' +
        '<span class="slide-counter" id="slideCounter"></span>' +
      '</div>' +
      '<button class="nav-btn" id="nextBtn">' +
        'Next <span>&#8594;</span> <kbd>&#8594;</kbd>' +
      '</button>'
    document.body.appendChild(footer)

    var backdrop = document.createElement('div')
    backdrop.className = 'overview-backdrop'
    backdrop.id = 'overviewBackdrop'
    backdrop.innerHTML = '<div class="overview-grid" id="overviewGrid"></div>'
    document.body.appendChild(backdrop)

    var closeBtn = document.createElement('button')
    closeBtn.className = 'overview-close'
    closeBtn.id = 'overviewClose'
    closeBtn.innerHTML = '&#10005;'
    document.body.appendChild(closeBtn)

    document.getElementById('prevBtn').addEventListener('click', goPrev)
    document.getElementById('nextBtn').addEventListener('click', goNext)
    document.getElementById('audioBtn').addEventListener('click', toggleMute)
    backdrop.addEventListener('click', closeOverview)
    closeBtn.addEventListener('click', toggleOverview)
  }

  // ===== STATE =====
  var currentSlideIndex = 0
  var currentStep = 0
  var isMuted = localStorage.getItem('presentation-muted') === 'true'
  var audioElement = new Audio()
  var overviewOpen = false
  var allSlides = []

  // ===== INIT =====
  function init() {
    bootstrap()

    allSlides = []
    PRESENTATION_DATA.sections.forEach(function (section) {
      section.slides.forEach(function (slide) {
        allSlides.push(Object.assign({}, slide, { sectionTitle: section.title }))
      })
    })

    restorePosition()
    updateMuteUI()
    renderOverview()
    renderSlide(true)

    document.addEventListener('keydown', handleKeydown)

    var touchStartX = 0
    document.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX })
    document.addEventListener('touchend', function (e) {
      var diff = e.changedTouches[0].clientX - touchStartX
      if (Math.abs(diff) > 60) {
        if (diff < 0) goNext()
        else goPrev()
      }
    })
  }

  function handleKeydown(e) {
    if (overviewOpen) {
      if (e.key === 'Escape') toggleOverview()
      return
    }
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        e.preventDefault()
        goNext()
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        goPrev()
        break
      case 'Home':
        e.preventDefault()
        goToSlide(0, 0)
        break
      case 'End':
        e.preventDefault()
        goToSlide(allSlides.length - 1, allSlides[allSlides.length - 1].steps.length - 1)
        break
      case 'Escape':
        toggleOverview()
        break
    }
  }

  // ===== POSITION PERSISTENCE =====
  function savePosition() {
    var hash = currentSlideIndex + '-' + currentStep
    history.replaceState(null, '', '#' + hash)
    sessionStorage.setItem('presentation-position', hash)
  }

  function restorePosition() {
    var hash = location.hash.replace('#', '')
    if (!hash) hash = sessionStorage.getItem('presentation-position') || ''
    if (hash) {
      var parts = hash.split('-').map(Number)
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        var slide = parts[0]
        var step = parts[1]
        if (slide >= 0 && slide < allSlides.length) {
          currentSlideIndex = slide
          var maxStep = allSlides[slide].steps.length - 1
          currentStep = Math.min(step, maxStep)
        }
      }
    }
  }

  // ===== NAVIGATION =====
  function goNext() {
    var slide = allSlides[currentSlideIndex]
    if (currentStep < slide.steps.length - 1) {
      currentStep++
      revealStep(currentStep)
      playStepAudio()
      updateUI()
      savePosition()
    } else if (currentSlideIndex < allSlides.length - 1) {
      currentSlideIndex++
      currentStep = 0
      renderSlide()
    }
  }

  function goPrev() {
    if (currentStep > 0) {
      currentStep--
      renderSlide(true)
    } else if (currentSlideIndex > 0) {
      currentSlideIndex--
      var prevSlide = allSlides[currentSlideIndex]
      currentStep = prevSlide.steps.length - 1
      renderSlide(true)
    }
  }

  function goToSlide(index, step) {
    if (step === undefined) step = 0
    currentSlideIndex = index
    currentStep = step
    renderSlide(true)
    if (overviewOpen) toggleOverview()
  }

  // ===== RENDERING =====
  // Slide content is author-controlled JSON from presentation-data.json.
  // innerHTML is used for performance; content is not user-generated.
  function renderSlide(instant) {
    if (instant === undefined) instant = false
    var slide = allSlides[currentSlideIndex]
    var container = document.getElementById('slideInner')
    var slideContainer = document.getElementById('slideContainer')

    var html = ''

    var isTitleSlide = slide.steps.length === 1
      && slide.steps[0].content.length <= 2
      && slide.steps[0].content.every(function (c) { return c.kind === 'text' || c.kind === 'heading' })

    if (isTitleSlide) {
      html += '<div class="title-slide">'
      html += '<h1 class="slide-title">' + slide.title + '</h1>'
      if (slide.subtitle) {
        html += '<p class="slide-subtitle">' + renderInlineMarkdown(slide.subtitle) + '</p>'
      }
      slide.steps[0].content.forEach(function (block) {
        if (block.kind === 'text') {
          html += '<p class="slide-subtitle">' + renderInlineMarkdown(block.text) + '</p>'
        }
      })
      html += '</div>'
    } else {
      html += '<h1 class="slide-title">' + slide.title + '</h1>'
      if (slide.subtitle) {
        html += '<p class="slide-subtitle">' + renderInlineMarkdown(slide.subtitle) + '</p>'
      }

      slide.steps.forEach(function (step, i) {
        var visible = i <= currentStep
        var cls = visible ? (instant ? 'step-block visible instant' : 'step-block visible') : 'step-block'
        html += '<div class="' + cls + '" data-step="' + i + '">'
        step.content.forEach(function (block) {
          html += renderContentBlock(block)
        })
        html += '</div>'
      })

      if (slide.steps.length > 1) {
        html += '<div class="step-dots">'
        slide.steps.forEach(function (_, i) {
          var dotClass = 'step-dot'
          if (i === currentStep) dotClass += ' active'
          else if (i < currentStep) dotClass += ' completed'
          html += '<button class="' + dotClass + '" data-step-dot="' + i + '" aria-label="Step ' + (i + 1) + '"></button>'
        })
        html += '</div>'
      }
    }

    container.innerHTML = html
    slideContainer.scrollTop = 0
    renderMermaidDiagrams(container)

    container.querySelectorAll('[data-step-dot]').forEach(function (dot) {
      dot.addEventListener('click', function () {
        goToStepDot(Number(dot.getAttribute('data-step-dot')))
      })
    })

    if (instant) {
      requestAnimationFrame(function () {
        container.querySelectorAll('.instant').forEach(function (el) { el.classList.remove('instant') })
      })
    }

    updateUI()
    savePosition()
    playStepAudio()
  }

  function revealStep(stepIndex) {
    var stepEl = document.querySelector('[data-step="' + stepIndex + '"]')
    if (stepEl) {
      stepEl.classList.add('visible')
      renderMermaidDiagrams(stepEl)
      setTimeout(function () {
        stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }

    document.querySelectorAll('.step-dot').forEach(function (dot, i) {
      dot.className = 'step-dot'
      if (i === currentStep) dot.classList.add('active')
      else if (i < currentStep) dot.classList.add('completed')
    })
  }

  function goToStepDot(stepIndex) {
    if (stepIndex <= currentStep) {
      currentStep = stepIndex
      renderSlide(true)
    } else {
      while (currentStep < stepIndex) {
        currentStep++
        revealStep(currentStep)
      }
      playStepAudio()
      updateUI()
    }
  }

  function renderContentBlock(block) {
    switch (block.kind) {
      case 'text':
        return '<p class="content-text">' + renderInlineMarkdown(block.text) + '</p>'

      case 'heading':
        return '<h2 class="content-heading">' + renderInlineMarkdown(block.text) + '</h2>'

      case 'code':
        return renderCodeBlock(block)

      case 'mermaid':
        return renderMermaidBlock(block)

      case 'image':
        return renderImageBlock(block)

      case 'bullets':
        var items = block.items.map(function (item) { return '<li>' + renderInlineMarkdown(item) + '</li>' }).join('')
        return '<ul class="content-bullets">' + items + '</ul>'

      case 'callout':
        var icons = { tip: '&#x1f4a1;', warning: '&#9888;&#65039;', info: '&#8505;&#65039;' }
        return '<div class="callout ' + block.variant + '">' +
          '<span class="callout-icon">' + (icons[block.variant] || icons.info) + '</span>' +
          '<span>' + renderInlineMarkdown(block.text) + '</span>' +
        '</div>'

      case 'comparison':
        return '<div class="comparison">' +
          '<div class="comparison-panel">' +
            '<div class="comparison-label">' + block.left.label + '</div>' +
            renderCodeBlock({ kind: 'code', language: block.left.language || 'typescript', code: block.left.code }) +
          '</div>' +
          '<div class="comparison-panel">' +
            '<div class="comparison-label">' + block.right.label + '</div>' +
            renderCodeBlock({ kind: 'code', language: block.right.language || 'typescript', code: block.right.code }) +
          '</div>' +
        '</div>'

      default:
        return ''
    }
  }

  function renderCodeBlock(block) {
    var lang = mapLanguage(block.language || 'typescript')
    var highlighted
    try {
      highlighted = hljs.highlight(block.code, { language: lang }).value
    } catch (e) {
      highlighted = escapeHtml(block.code)
    }

    var lines = splitHighlightedLines(highlighted)
    var highlightSet = new Set(block.highlight || [])

    var linesHtml = lines.map(function (line, i) {
      var lineNum = i + 1
      var cls = highlightSet.has(lineNum) ? 'code-line highlighted' : 'code-line'
      return '<span class="' + cls + '">' + line + '</span>'
    }).join('')

    var headerHtml = ''
    if (block.filename || block.language) {
      headerHtml = '<div class="code-header">' +
        '<span class="code-filename">' + (block.filename || '') + '</span>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<span class="code-lang">' + (block.language || '') + '</span>' +
          '<button class="code-copy-btn" data-copy-code>Copy</button>' +
        '</div>' +
      '</div>'
    }

    return '<div class="code-block">' +
      headerHtml +
      '<div class="code-body"><pre><code class="hljs">' + linesHtml + '</code></pre></div>' +
    '</div>'
  }

  function renderImageBlock(block) {
    if (!block.src) {
      return '<div class="image-error">image block missing src</div>'
    }
    var sizeClass = block.size ? 'size-' + escapeHtml(block.size) : ''
    var frameClass = block.frame === false ? 'no-frame' : ''
    var classes = ['image-block', sizeClass, frameClass].filter(Boolean).join(' ')
    var alt = escapeHtml(block.alt || '')
    var src = escapeHtml(block.src)
    var caption = block.caption
      ? '<div class="image-caption">' + renderInlineMarkdown(block.caption) + '</div>'
      : ''
    return '<div class="' + classes + '">' +
      '<img src="' + src + '" alt="' + alt + '" loading="lazy" onerror="window.__presentationImageError(this)">' +
      caption +
    '</div>'
  }

  window.__presentationImageError = function (img) {
    var src = img.getAttribute('src') || ''
    var div = document.createElement('div')
    div.className = 'image-error'
    div.textContent = 'Failed to load image: ' + src
    img.replaceWith(div)
  }

  var mermaidIdCounter = 0
  function renderMermaidBlock(block) {
    var id = 'mermaid-' + (++mermaidIdCounter)
    return '<div class="mermaid-block"><div class="mermaid" id="' + id + '">' + escapeHtml(block.diagram || '') + '</div></div>'
  }

  async function renderMermaidDiagrams(root) {
    if (!window.mermaid) return
    var scope = root || document
    var nodes = scope.querySelectorAll('.mermaid:not([data-processed="true"])')
    for (var node of nodes) {
      var source = node.textContent
      var id = node.id || ('mermaid-' + (++mermaidIdCounter))
      try {
        var result = await window.mermaid.render(id + '-svg', source)
        node.innerHTML = result.svg
        if (result.bindFunctions) result.bindFunctions(node)
        node.setAttribute('data-processed', 'true')
      } catch (err) {
        node.textContent = 'Mermaid render error: ' + (err && err.message ? err.message : String(err))
        node.classList.add('mermaid-error')
        node.setAttribute('data-processed', 'true')
      }
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy-code]')
    if (!btn) return
    var code = btn.closest('.code-block').querySelector('code').textContent
    navigator.clipboard.writeText(code).then(function () {
      btn.textContent = 'Copied!'
      setTimeout(function () { btn.textContent = 'Copy' }, 1500)
    })
  })

  // ===== INLINE MARKDOWN =====
  function renderInlineMarkdown(text) {
    if (!text) return ''
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:var(--accent)" target="_blank">$1</a>')
  }

  // ===== SYNTAX HIGHLIGHTING (Highlight.js) =====
  function mapLanguage(lang) {
    var map = {
      'py': 'python',
      'golang': 'go',
      'postgres': 'pgsql',
      'postgresql': 'pgsql',
      'sh': 'bash',
      'shell': 'bash',
      'svg': 'xml',
      'html': 'xml',
    }
    return map[lang] || lang
  }

  function splitHighlightedLines(html) {
    var lines = []
    var currentLine = ''
    var openTags = []
    var i = 0

    while (i < html.length) {
      if (html[i] === '\n') {
        var closers = openTags.map(function () { return '</span>' }).reverse().join('')
        lines.push(currentLine + closers)
        currentLine = openTags.join('')
        i++
      } else if (html[i] === '<') {
        var tagEnd = html.indexOf('>', i)
        if (tagEnd === -1) { currentLine += html[i]; i++; continue }
        var tag = html.substring(i, tagEnd + 1)
        if (tag.startsWith('</')) {
          openTags.pop()
        } else if (!tag.endsWith('/>')) {
          openTags.push(tag)
        }
        currentLine += tag
        i = tagEnd + 1
      } else {
        currentLine += html[i]
        i++
      }
    }

    var closers = openTags.map(function () { return '</span>' }).reverse().join('')
    lines.push(currentLine + closers)
    return lines
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  // ===== AUDIO =====
  function playStepAudio() {
    if (isMuted) return
    var slide = allSlides[currentSlideIndex]
    var step = slide.steps[currentStep]
    if (step && step.narration) {
      audioElement.pause()
      audioElement.src = 'audio/' + step.narration
      audioElement.play().catch(function () {})
    }
  }

  function toggleMute() {
    isMuted = !isMuted
    localStorage.setItem('presentation-muted', isMuted)
    updateMuteUI()
    if (isMuted) {
      audioElement.pause()
    } else {
      playStepAudio()
    }
  }

  function updateMuteUI() {
    var icon = document.getElementById('audioIcon')
    var btn = document.getElementById('audioBtn')
    if (isMuted) {
      icon.innerHTML = '&#128264;'
      btn.classList.add('muted')
    } else {
      icon.innerHTML = '&#128266;'
      btn.classList.remove('muted')
    }
  }

  // ===== UI UPDATES =====
  function updateUI() {
    var slide = allSlides[currentSlideIndex]
    var totalSlides = allSlides.length

    document.getElementById('sectionBadge').textContent = slide.sectionTitle
    document.getElementById('headerTitle').textContent = slide.title
    document.getElementById('slidePosition').textContent = (currentSlideIndex + 1) + ' / ' + totalSlides

    var totalSteps = allSlides.reduce(function (sum, s) { return sum + s.steps.length }, 0)
    var completedSteps = 0
    for (var i = 0; i < currentSlideIndex; i++) {
      completedSteps += allSlides[i].steps.length
    }
    completedSteps += currentStep + 1
    var progress = (completedSteps / totalSteps) * 100
    document.getElementById('progressBar').style.width = progress + '%'

    document.getElementById('prevBtn').disabled = currentSlideIndex === 0 && currentStep === 0
    document.getElementById('nextBtn').disabled = currentSlideIndex === totalSlides - 1 && currentStep === slide.steps.length - 1

    document.getElementById('slideCounter').textContent = 'Step ' + (currentStep + 1) + ' of ' + slide.steps.length

    document.querySelectorAll('.overview-card').forEach(function (card, i) {
      card.classList.toggle('current', i === currentSlideIndex)
    })
  }

  // ===== OVERVIEW =====
  function renderOverview() {
    var grid = document.getElementById('overviewGrid')
    var html = ''
    allSlides.forEach(function (slide, i) {
      var cls = i === currentSlideIndex ? 'overview-card current' : 'overview-card'
      html += '<div class="' + cls + '" data-slide-index="' + i + '">' +
        '<div class="overview-card-section">' + slide.sectionTitle + '</div>' +
        '<div class="overview-card-title">' + slide.title + '</div>' +
        '<div class="overview-card-steps">' + slide.steps.length + ' step' + (slide.steps.length > 1 ? 's' : '') + '</div>' +
      '</div>'
    })
    grid.innerHTML = html

    grid.querySelectorAll('[data-slide-index]').forEach(function (card) {
      card.addEventListener('click', function () {
        goToSlide(Number(card.getAttribute('data-slide-index')))
      })
    })
  }

  function toggleOverview() {
    overviewOpen = !overviewOpen
    document.getElementById('overviewBackdrop').classList.toggle('open', overviewOpen)
    if (overviewOpen) renderOverview()
  }

  function closeOverview(e) {
    if (e.target === document.getElementById('overviewBackdrop')) {
      toggleOverview()
    }
  }

  // ===== START =====
  init()
})()

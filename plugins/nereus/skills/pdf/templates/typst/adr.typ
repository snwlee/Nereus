// ADR 템플릿. 사용: #import "adr.typ": doc / #show: doc.with(title: "...", font: "...")
#let doc(title: "문서", font: "Noto Sans KR", subtitle: none, author: none, date: datetime.today().display("[year]-[month]-[day]"), body) = {
  set document(title: title, author: if author != none { author } else { "" })
  set page(paper: "a4", margin: (x: 22mm, y: 24mm), numbering: "1", number-align: center,
    header: context { if counter(page).get().first() > 1 { text(size: 9pt, fill: luma(110))[#title] ; h(1fr); text(size: 9pt, fill: luma(110))[ARCHITECTURE DECISION RECORD] } })
  set text(font: (font, "Noto Sans", "Helvetica"), size: 10.5pt, lang: "ko", hyphenate: false)
  set par(justify: true, leading: 0.75em, first-line-indent: 0em)
  show heading.where(level: 1): it => { v(1.4em); text(size: 18pt, weight: 700, fill: rgb("#7a3e00"))[#it.body]; v(0.4em); line(length: 100%, stroke: 0.6pt + rgb("#7a3e00")); v(0.6em) }
  show heading.where(level: 2): it => { v(1em); text(size: 13.5pt, weight: 600)[#it.body]; v(0.3em) }
  show heading.where(level: 3): it => { v(0.7em); text(size: 11.5pt, weight: 600, fill: luma(60))[#it.body]; v(0.2em) }
  show raw.where(block: true): it => block(fill: luma(246), inset: 9pt, radius: 3pt, width: 100%, text(size: 9pt, it))
  show raw.where(block: false): it => box(fill: luma(240), inset: (x: 3pt), outset: (y: 2.5pt), radius: 2pt, text(size: 9.2pt, it))
  show table: set text(size: 9.5pt)
  set table(stroke: 0.5pt + luma(200), inset: 6pt)
  // 표지
  v(18%)
  text(size: 11pt, fill: rgb("#7a3e00"), tracking: 0.12em, weight: 600)[ARCHITECTURE DECISION RECORD]
  v(0.6em)
  text(size: 28pt, weight: 700)[#title]
  if subtitle != none { v(0.5em); text(size: 14pt, fill: luma(90))[#subtitle] }
  v(1.2em)
  line(length: 30%, stroke: 1.2pt + rgb("#7a3e00"))
  v(0.8em)
  text(size: 10.5pt, fill: luma(110))[#if author != none [#author · ] #date]
  pagebreak()
  text(size: 9.5pt, fill: luma(110))[섹션 순서: 맥락 → 결정 → 고려한 대안 → 결과와 트레이드오프]; v(0.8em)
  body
}

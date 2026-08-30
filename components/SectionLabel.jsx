// The rule-line + small-caps marker that opens every section — the single most
// recognizable signature of the editorial design system. See app/globals.css's
// .section-label rules for the actual styling; this component just gives the markup
// a name so it isn't hand-rolled slightly differently in a dozen places.
export default function SectionLabel({ children }) {
  return (
    <div className="section-label">
      <span className="section-label-rule" aria-hidden="true" />
      <span className="section-label-text">{children}</span>
      <span className="section-label-rule" aria-hidden="true" />
    </div>
  )
}

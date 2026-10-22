import styles from './ui.module.css'

// Stands in for a photo until staff upload one in Admin → Site content. A designed panel (a
// hairline grid and a brass seal), never a stock photo or a fake person. The caption names the
// slot so staff can see what goes where; on the public site it reads as a quiet label.
export default function PhotoPlaceholder({ label, showCaption = true }: { label: string; showCaption?: boolean }) {
  return (
    <div className={styles.placeholder} role="img" aria-label={`${label} (photo to come)`}>
      <div className={styles.placeholderSeal} aria-hidden="true">
        <span>PLP</span>
      </div>
      {showCaption && <span className={styles.placeholderCaption} aria-hidden="true">{label}</span>}
    </div>
  )
}

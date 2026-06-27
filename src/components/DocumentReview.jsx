import { useEffect, useState } from 'react'
import { generatePdfBlobUrl, downloadPdf } from '../utils/pdfGenerator'

export default function DocumentReview({ service, formData, onNext, onBack }) {
  const [blobUrl, setBlobUrl] = useState('')

  useEffect(() => {
    const url = generatePdfBlobUrl(service, formData)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">Step 4 of 4</span>
          <h2>Your Document Is Ready</h2>
          <p>Review your {service.title.toLowerCase()} document below, then download it.</p>
        </div>

        {blobUrl && <iframe title="Document preview" src={blobUrl} className="pdf-frame" />}

        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={onBack}>
            ← Back
          </button>
          <button type="button" className="btn" onClick={() => downloadPdf(service, formData)}>
            Download PDF
          </button>
          <button type="button" className="btn btn-primary" onClick={onNext}>
            Continue to Next Steps →
          </button>
        </div>
      </div>
    </div>
  )
}

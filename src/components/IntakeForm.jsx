import { useState } from 'react'

export default function IntakeForm({ service, onSubmit, onBack }) {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field.name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {}
    for (const field of service.fields) {
      if (field.required && !values[field.name]) {
        nextErrors[field.name] = `${field.label} is required`
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      onSubmit(values)
    }
  }

  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">{service.tagline}</span>
          <h2>{service.title} — Intake Form</h2>
          <p>Fill in the details below. We'll use this to generate your document.</p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 720 }}>
          <div className="form-grid">
            {service.fields.map((field) => (
              <div className="form-group" key={field.name}>
                <label>
                  {field.label} {field.required && <span className="required">*</span>}
                </label>
                {field.type === 'textarea' && (
                  <textarea
                    className="input"
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                  />
                )}
                {field.type === 'select' && (
                  <select
                    className="input"
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'file' && (
                  <input
                    className="input"
                    type="file"
                    onChange={(e) => handleChange(field, e.target.files[0])}
                  />
                )}
                {['text', 'number', 'date'].includes(field.type) && (
                  <input
                    className="input"
                    type={field.type}
                    value={values[field.name] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                  />
                )}
                {errors[field.name] && <span className="error-text">{errors[field.name]}</span>}
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={onBack}>
              ← Back
            </button>
            <button type="submit" className="btn btn-primary">
              Continue to Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

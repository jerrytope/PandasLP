import { SERVICES, LAWYER_CONSULT_FEE } from '../data/services'

export default function ServiceCards({ onSelectService, onStartLawyerConsult }) {
  return (
    <div className="services-grid">
      {SERVICES.map((service, i) => (
        <div
          key={service.id}
          className="card card-gradient card-interactive service-card fade-in"
          style={{ animationDelay: `${i * 0.08}s` }}
          onClick={() => onSelectService(service)}
        >
          <span className="service-icon">{service.icon}</span>
          <span className="service-tagline">{service.tagline}</span>
          <span className="service-title">{service.title}</span>
          <p className="service-description">{service.description}</p>
          <span className="service-price">From ₦{service.price.toLocaleString()}</span>
        </div>
      ))}

      <div
        className="card card-gradient card-interactive service-card fade-in"
        style={{ animationDelay: `${SERVICES.length * 0.08}s` }}
        onClick={onStartLawyerConsult}
      >
        <span className="service-icon">👩‍⚖️</span>
        <span className="service-tagline">Calendly Booking</span>
        <span className="service-title">Speak to a Lawyer</span>
        <p className="service-description">
          Book a one-on-one session with a licensed legal practitioner for personalised advice.
        </p>
        <span className="service-price">Consultation fee: ₦{LAWYER_CONSULT_FEE.toLocaleString()}</span>
      </div>
    </div>
  )
}

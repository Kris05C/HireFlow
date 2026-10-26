import { useState } from 'react'
import { companyConfig } from '../config'
import { Button, FormField, Modal } from '../components/UI'
import { formatINR, productCatalog } from '../../shared/productCatalog'

const plans = productCatalog.filter((product) => product.type === 'subscription' && product.id !== 'enterprise')
const enterprisePlan = productCatalog.find((product) => product.id === 'enterprise')
const setupService = productCatalog.find((product) => product.id === 'data-setup')
const knownProductIds = new Set(productCatalog.map((product) => product.id))

function readSelection() {
  try {
    const selection = localStorage.getItem('hireflow-plan-selection') || ''
    return knownProductIds.has(selection) ? selection : ''
  } catch (error) {
    console.error('Could not read plan selection', error)
    return ''
  }
}

export function PricingPage({ initialSelection, onSelectPlan }) {
  const [localSelection, setLocalSelection] = useState(() => initialSelection ?? readSelection())
  const selection = initialSelection === undefined ? localSelection : initialSelection
  const [showSummary, setShowSummary] = useState(false)
  const [showEnterpriseForm, setShowEnterpriseForm] = useState(false)
  const [inquiry, setInquiry] = useState({ name: '', company: '', email: '', requirements: '' })
  const [inquiryHref, setInquiryHref] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [selecting, setSelecting] = useState(false)
  const selectedProduct = productCatalog.find((product) => product.id === selection)
  const updateInquiry = (key, value) => {
    setInquiry((current) => ({ ...current, [key]: value }))
    setInquiryHref('')
  }
  const choosePlan = async (planId) => {
    setSelecting(true)
    try {
      if (onSelectPlan) await onSelectPlan(planId)
      else {
        localStorage.setItem('hireflow-plan-selection', planId)
        setLocalSelection(planId)
      }
      setSelectionError('')
      setShowSummary(true)
    } catch (error) {
      console.error('Could not save plan selection', error)
      setSelectionError(error.message || 'This plan selection could not be saved.')
    } finally {
      setSelecting(false)
    }
  }
  const submitEnterpriseInquiry = (event) => {
    event.preventDefault()
    if (!inquiry.name.trim() || !inquiry.company.trim() || !inquiry.email.trim() || !inquiry.requirements.trim()) return
    const subject = encodeURIComponent(`HireFlow Enterprise inquiry from ${inquiry.company.trim()}`)
    const body = encodeURIComponent(`Name: ${inquiry.name.trim()}\nCompany: ${inquiry.company.trim()}\nEmail: ${inquiry.email.trim()}\nRequirements: ${inquiry.requirements.trim()}`)
    setInquiryHref(`mailto:${companyConfig.businessEmail}?subject=${subject}&body=${body}`)
  }

  if (showSummary && selectedProduct) {
    const isSubscription = selectedProduct.type === 'subscription'
    const amount = selectedProduct.amountPaise ?? selectedProduct.startingAmountPaise
    const frequency = selectedProduct.billingInterval === 'one-time' ? 'One-time service' : 'Billed monthly'
    return (
      <div className="pricing-page selection-page">
        <div className="pricing-intro">
          <div>
            <span className="pricing-overline">PLAN SUMMARY</span>
            <h2>Your HireFlow selection</h2>
            <p>Review the selected plan and included features before returning to pricing.</p>
          </div>
          <span className="billing-label">{frequency.toUpperCase()}</span>
        </div>
        <section className="selected-plan-panel" aria-labelledby="selected-plan-name">
          <div className="selected-plan-heading">
            <div>
              <span className="selected-plan-kicker">{isSubscription ? 'MONTHLY PLAN' : 'ONE-TIME SERVICE'}</span>
              <h3 id="selected-plan-name">{selectedProduct.name}</h3>
              <p>{selectedProduct.audience}</p>
            </div>
            <div className="selected-plan-price">
              {selectedProduct.pricingType === 'custom' ? `From ${formatINR(amount)}` : formatINR(amount)}
              <small>{isSubscription ? '/ month' : ' / project'}</small>
            </div>
          </div>
          <div className="selected-plan-features">
            <h4>Included</h4>
            <ul className="plan-features">{selectedProduct.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          </div>
          <div className="selection-status" role="status">
            <span className="selection-status-mark" aria-hidden="true">✓</span>
            <div><strong>Selected, not purchased</strong><p>No payment was made and no subscription is active.</p></div>
          </div>
          <div className="selected-plan-actions">
            <Button variant="secondary" onClick={() => setShowSummary(false)}>Back to Pricing</Button>
            <span>Checkout is not configured yet.</span>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="pricing-page">
      <div className="pricing-intro">
        <div>
          <span className="pricing-overline">HIREFLOW PLANS</span>
          <h2>Pricing for your hiring workload</h2>
          <p>Monthly plans for recruitment teams of different sizes. Prices are shown in Indian Rupees.</p>
        </div>
        <span className="billing-label">BILLED MONTHLY</span>
      </div>

      <p className="pricing-disclosure" role="note">Proposed plan catalog. Listed features are not active product entitlements yet, and checkout is not available. Selecting a plan does not purchase or activate it.</p>

      <div className="plan-grid">
        {plans.map((plan) => (
          <article className={`plan-card ${plan.id === 'professional' ? 'plan-card-recommended' : ''} ${selection === plan.id ? 'plan-card-selected' : ''}`} key={plan.id}>
            <div className="plan-card-heading">
              <div><h3>{plan.name}</h3><p>{plan.audience}</p></div>
              <div className="plan-card-badges">{plan.id === 'professional' && <span className="plan-recommended-label">Recommended</span>}{selection === plan.id && <span className="plan-selected-label">Selected</span>}</div>
            </div>
            <div className="plan-price">{formatINR(plan.amountPaise)}<small>/ month</small></div>
            <Button className="plan-select-button" variant={selection === plan.id ? 'secondary' : 'primary'} disabled={selecting} onClick={() => selection === plan.id ? setShowSummary(true) : choosePlan(plan.id)}>
              {selecting ? 'Saving…' : selection === plan.id ? 'View selection' : 'Select plan'}
            </Button>
            <ul className="plan-features">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          </article>
        ))}
        <article className="plan-card enterprise-plan">
          <div className="plan-card-heading"><div><h3>{enterprisePlan.name}</h3><p>{enterprisePlan.audience}</p></div></div>
          <div className="plan-price enterprise-price"><small>Custom pricing from</small><strong>{formatINR(enterprisePlan.startingAmountPaise)} / month</strong></div>
          <Button className="plan-select-button" variant="secondary" onClick={() => { setInquiryHref(''); setShowEnterpriseForm(true) }}>Request Enterprise pricing</Button>
          <ul className="plan-features">{enterprisePlan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        </article>
      </div>

      <section className="pricing-service">
        <div><span className="pricing-overline">ONE-TIME SERVICE</span><h3>{setupService.name}</h3><p>{setupService.features.join('. ')}.</p></div>
        <div className="service-price"><strong>{formatINR(setupService.amountPaise)}</strong><span>per project · one-time</span></div>
        <Button variant={selection === setupService.id ? 'secondary' : 'primary'} disabled={selecting} onClick={() => selection === setupService.id ? setShowSummary(true) : choosePlan(setupService.id)}>{selecting ? 'Saving…' : selection === setupService.id ? 'View selection' : 'Select service'}</Button>
      </section>

      {selectionError && <p className="form-error" role="alert">{selectionError}</p>}
      {selection && <p className="selection-notice" role="status">{onSelectPlan ? 'Your selection is saved to your workspace.' : 'Your selection is saved in this browser only.'} No subscription or payment has been created.</p>}

      <section className="pricing-terms">
        <h3>Candidate data and payment status</h3>
        <p>Candidate records must be obtained and processed lawfully, with appropriate consent, privacy notices, retention, and deletion controls before production use. HireFlow does not scrape private profiles or infer willingness to change jobs. These plan selections are informational only; accounts, plan entitlements, and payment processing are not active until a secure backend and payment provider are configured.</p>
      </section>
      {showEnterpriseForm && <Modal title="Enterprise pricing inquiry" subtitle="Prepare an inquiry email for the HireFlow team." onClose={() => setShowEnterpriseForm(false)}>
        <form className="modal-form" onSubmit={submitEnterpriseInquiry}>
          <FormField label="Your name"><input autoFocus value={inquiry.name} onChange={(event) => updateInquiry('name', event.target.value)} required /></FormField>
          <FormField label="Company"><input value={inquiry.company} onChange={(event) => updateInquiry('company', event.target.value)} required /></FormField>
          <FormField label="Work email"><input type="email" value={inquiry.email} onChange={(event) => updateInquiry('email', event.target.value)} required /></FormField>
          <FormField label="What does your team need?"><textarea rows="4" value={inquiry.requirements} onChange={(event) => updateInquiry('requirements', event.target.value)} required /></FormField>
          {inquiryHref ? <p className="inquiry-ready" role="status">Your inquiry is ready. Open your email application to review and send it.</p> : <p className="inquiry-note">This form prepares an email draft; it does not send or store your inquiry.</p>}
          <div className="modal-actions"><Button variant="secondary" onClick={() => setShowEnterpriseForm(false)}>Cancel</Button>{inquiryHref ? <a className="hf-button hf-button-primary" href={inquiryHref}>Open email draft</a> : <Button type="submit">Prepare inquiry</Button>}</div>
        </form>
      </Modal>}
    </div>
  )
}
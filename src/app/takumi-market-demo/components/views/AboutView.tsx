'use client'

import { useState } from 'react'
import { FiCamera, FiChevronDown, FiDollarSign, FiPackage, FiPenTool } from 'react-icons/fi'
import { Region, ViewParams } from '../../types'
import { Reveal } from '../shared'
import styles from '../../takumi-market.module.css'

const steps = [
  { title: 'Application', description: 'Each maker submits studio history, sample categories, and production scope.', stat: '127 makers applied' },
  { title: 'Studio Review', description: 'Takumi Market reviews workshop practices, provenance, and category fit.', stat: '41 studio visits' },
  { title: 'Sample Evaluation', description: 'We review sample pieces for finish quality, consistency, and documentation.', stat: '23 selected' },
  { title: 'Listing', description: 'Approved makers launch with localized pricing, logistics notes, and editorial storytelling.', stat: '180+ products live' }
]

const supportCards = [
  { icon: FiPenTool, title: 'Translation & Localization', body: 'Product pages and maker stories are adapted for global buyers without flattening the maker’s voice.' },
  { icon: FiCamera, title: 'Photography & Storytelling', body: 'We help present process, studio atmosphere, and trust markers in a bright editorial frame.' },
  { icon: FiPackage, title: 'Global Logistics', body: 'Shipping windows, duties context, and fulfillment expectations stay explicit at every step.' },
  { icon: FiDollarSign, title: 'Regional Pricing', body: 'Makers set their own price. The platform localizes it clearly for each region without hidden fees.' }
]

const faqs = [
  {
    q: 'How are makers selected?',
    a: 'Takumi Market reviews studio history, samples, provenance, and whether the maker can support global fulfillment without compromising quality.'
  },
  {
    q: 'How does auction work?',
    a: 'Only a portion of inventory enters auction for unusually limited releases. The remainder stays available at fixed price whenever possible.'
  },
  {
    q: 'Are prices negotiable?',
    a: 'No. Makers set the base price, and the platform adds a flat 15% fee with no hidden commissions.'
  },
  {
    q: 'What about returns?',
    a: 'Return terms depend on category and shipping condition, but buyers always see the guidance clearly before ordering.'
  },
  {
    q: 'How are duties handled?',
    a: 'Import duties are noted per region and surfaced throughout product, cart, and checkout views so they are not a surprise.'
  },
  {
    q: 'Can I visit a maker’s studio?',
    a: 'Some makers accept visits by arrangement, but the platform treats studio access as an exception rather than a promise.'
  }
]

export function AboutView({ region, onNavigate }: { region: Region; onNavigate: (params: ViewParams) => void }) {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <div className={styles.viewStack}>
      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.manifestoHero}>
            <p className={styles.eyebrow}>Trust & Platform Story</p>
            <h1 className={styles.displayTitle}>We believe great craft deserves a global stage — and the makers behind it deserve a fair deal.</h1>
          </div>
        </Reveal>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>How Vetting Works</p>
            <h2 className={styles.sectionTitle}>A selective process designed to make trust visible.</h2>
          </div>
        </Reveal>
        <div className={styles.processSteps}>
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 60} className={styles.processStep}>
              <span className={styles.stepNumberLarge}>{index + 1}</span>
              <h3 className={styles.processStepTitle}>{step.title}</h3>
              <p className={styles.bodyCopy}>{step.description}</p>
              <p className={styles.processStat}>{step.stat}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>What We Do For Makers</p>
            <h2 className={styles.sectionTitle}>Platform support without turning the platform into the hero.</h2>
          </div>
        </Reveal>
        <div className={styles.supportGrid}>
          {supportCards.map((card, index) => (
            <Reveal key={card.title} delay={index * 60} className={styles.supportCard}>
              <card.icon aria-hidden className={styles.supportIcon} />
              <h3 className={styles.processStepTitle}>{card.title}</h3>
              <p className={styles.bodyCopy}>{card.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.sectionShell}>
        <div className={styles.aboutSplit}>
          <Reveal>
            <div className={styles.pricingCard}>
              <p className={styles.eyebrow}>Pricing Principles</p>
              <h2 className={styles.sectionTitle}>Transparent by default.</h2>
              <p className={styles.bodyCopy}>Makers set their own prices. We add a flat 15% platform fee. No hidden commissions. No pay-to-rank.</p>
            </div>
          </Reveal>
          <Reveal>
            <div className={`${styles.provenanceCard} ${styles.dotGridSection}`}>
              <div className={styles.provenanceSeal}>Verified</div>
              <div>
                <h2 className={styles.sectionTitle}>Provenance & Trust</h2>
                <p className={styles.bodyCopyMuted}>
                  Anti-counterfeit review, origin checks, materials disclosure, and process documentation are built into the listing workflow.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={styles.sectionShell}>
        <div className={styles.statsRow}>
          {[
            '23 Vetted Makers',
            '180+ Products',
            '5 Shipping Regions',
            '12 Craft Disciplines'
          ].map((stat, index) => (
            <Reveal key={stat} delay={index * 60} className={styles.statCard}>
              {stat}
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.sectionShell}>
        <Reveal>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>FAQ</p>
            <h2 className={styles.sectionTitle}>A few practical questions.</h2>
          </div>
        </Reveal>
        <div className={styles.faqList}>
          {faqs.map((faq, index) => (
            <Reveal key={faq.q} delay={index * 40}>
              <div className={styles.faqItem}>
                <button
                  type="button"
                  className={styles.faqQuestion}
                  aria-expanded={openFaq === index}
                  onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                  <span>{faq.q}</span>
                  <FiChevronDown aria-hidden className={openFaq === index ? styles.chevronOpen : ''} />
                </button>
                {openFaq === index ? <p className={styles.faqAnswer}>{faq.a}</p> : null}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.sectionShellCompact}>
        <button type="button" className={styles.buttonSecondary} onClick={() => onNavigate({ view: 'marketplace', region })}>
          Browse the Marketplace
        </button>
      </section>
    </div>
  )
}

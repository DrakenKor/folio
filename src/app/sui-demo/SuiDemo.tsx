'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiCopy,
  FiDroplet,
  FiImage,
  FiInstagram,
  FiLayers,
  FiMapPin,
  FiMessageCircle,
  FiPlus,
  FiSliders,
  FiStar
} from 'react-icons/fi'
import { ConcernSelector } from './components/ConcernSelector'
import { ContactPanel } from './components/ContactPanel'
import { DesignSwitcher } from './components/DesignSwitcher'
import { ReservationDrawer } from './components/ReservationDrawer'
import { ServiceCard } from './components/ServiceCard'
import { SourceViewer } from './components/SourceViewer'
import { TrustStrip } from './components/TrustStrip'
import { assets, firstTimeOffer, intensities, options, salon, services, skinGoals, timePreferences } from './data'
import styles from './sui-demo.module.css'
import type { ConcernId, DesignId, Intensity, OptionId, ServiceId, SkinGoal, TimePreference } from './types'
import {
  defaultDesignId,
  formatYen,
  getConcernRecommendation,
  getConsultationRecommendation,
  getOptionById,
  getServiceById,
  optionKey,
  sanitizeDesign,
  totals
} from './utils'

interface SuiDemoProps {
  className?: string
}

interface DemoViewProps {
  concern: ConcernId
  recommendation: ReturnType<typeof getConcernRecommendation>
  selectedServiceId: ServiceId
  selectedOptionIds: OptionId[]
  expandedServiceId: ServiceId
  totalDuration: number
  totalPrice: number
  intensity: Intensity
  goal: SkinGoal
  timePreference: TimePreference
  contactMethod: 'LINE' | 'Instagram' | 'Access'
  onConcernChange: (concern: ConcernId) => void
  onToggleService: (serviceId: ServiceId) => void
  onSelectService: (serviceId: ServiceId) => void
  onToggleOption: (optionId: OptionId) => void
  onReserve: (serviceId?: ServiceId) => void
  onCopy: (value: string, label: string) => void
  onIntensityChange: (intensity: Intensity) => void
  onGoalChange: (goal: SkinGoal) => void
  onTimePreferenceChange: (timePreference: TimePreference) => void
  onContactMethodChange: (method: 'LINE' | 'Instagram' | 'Access') => void
}

const designClassMap: Record<DesignId, string> = {
  'botanical-flyer': styles.botanicalFlyer,
  'soft-spa-menu': styles.softSpaMenu,
  'consultation-studio': styles.consultationStudio,
  'reservation-concierge': styles.reservationConcierge
}

export function SuiDemo({ className }: SuiDemoProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawDesign = searchParams.get('design')
  const designId = sanitizeDesign(rawDesign)
  const [concern, setConcern] = useState<ConcernId>('乾燥')
  const [intensity, setIntensity] = useState<Intensity>('気になる')
  const [goal, setGoal] = useState<SkinGoal>('うるおい')
  const [timePreference, setTimePreference] = useState<TimePreference>('45分まで')
  const [selectedServiceId, setSelectedServiceId] = useState<ServiceId>('premium-exosome')
  const [selectedOptionIds, setSelectedOptionIds] = useState<OptionId[]>(['moisture-pack'])
  const [expandedServiceId, setExpandedServiceId] = useState<ServiceId>('premium-exosome')
  const [reservationOpen, setReservationOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [contactMethod, setContactMethod] = useState<'LINE' | 'Instagram' | 'Access'>('LINE')
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    if (rawDesign !== null && rawDesign !== designId) {
      startTransition(() => {
        router.replace(`/sui-demo?design=${defaultDesignId}`, { scroll: false })
      })
    }
  }, [designId, rawDesign, router])

  const handleDesignChange = useCallback(
    (nextDesign: DesignId) => {
      startTransition(() => {
        router.push(`/sui-demo?design=${nextDesign}`, { scroll: false })
      })
    },
    [router]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return
      }

      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }

      const shortcut = Number(event.key)
      if (shortcut >= 1 && shortcut <= 4) {
        const nextDesign = ['botanical-flyer', 'soft-spa-menu', 'consultation-studio', 'reservation-concierge'][shortcut - 1] as DesignId
        handleDesignChange(nextDesign)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDesignChange])

  const recommendation = useMemo(() => {
    if (designId === 'consultation-studio') {
      return getConsultationRecommendation({ concern, intensity, goal, timePreference })
    }

    return getConcernRecommendation(concern)
  }, [concern, designId, goal, intensity, timePreference])

  const recommendationKey = `${recommendation.serviceId}:${optionKey(recommendation.optionIds)}`

  useEffect(() => {
    setSelectedServiceId(recommendation.serviceId)
    setSelectedOptionIds([...recommendation.optionIds])
    setExpandedServiceId(recommendation.serviceId)
  }, [recommendationKey, recommendation.serviceId])

  const selectedService = getServiceById(selectedServiceId)
  const selectedOptions = selectedOptionIds.map(getOptionById)
  const summary = totals(selectedServiceId, selectedOptionIds)

  const handleToggleOption = (optionId: OptionId) => {
    setSelectedOptionIds((current) => (current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]))
  }

  const handleSelectService = (serviceId: ServiceId) => {
    setSelectedServiceId(serviceId)
    setExpandedServiceId(serviceId)
  }

  const handleToggleService = (serviceId: ServiceId) => {
    setExpandedServiceId(serviceId)
    setSelectedServiceId(serviceId)
  }

  const handleReserve = (serviceId?: ServiceId) => {
    if (serviceId) {
      setSelectedServiceId(serviceId)
      setExpandedServiceId(serviceId)
    }

    setReservationOpen(true)
  }

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyMessage(`${label}をコピーしました`)
    } catch {
      setCopyMessage(`${label}: ${value}`)
    }

    window.setTimeout(() => setCopyMessage(''), 2200)
  }, [])

  const viewProps: DemoViewProps = {
    concern,
    recommendation,
    selectedServiceId,
    selectedOptionIds,
    expandedServiceId,
    totalDuration: summary.durationMinutes,
    totalPrice: summary.priceValue,
    intensity,
    goal,
    timePreference,
    contactMethod,
    onConcernChange: setConcern,
    onToggleService: handleToggleService,
    onSelectService: handleSelectService,
    onToggleOption: handleToggleOption,
    onReserve: handleReserve,
    onCopy: handleCopy,
    onIntensityChange: setIntensity,
    onGoalChange: setGoal,
    onTimePreferenceChange: setTimePreference,
    onContactMethodChange: setContactMethod
  }

  const content = renderDesign(designId, viewProps)

  return (
    <div className={`${styles.page} ${designClassMap[designId]} ${className ?? ''}`} lang="ja" data-design={designId}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.brandLockup}>
            <span className={styles.brandMark}>
              <Image src={assets.logo} alt="" width={44} height={44} priority />
            </span>
            <span>
              <strong>{salon.name}</strong>
              <small>{salon.descriptor}</small>
            </span>
          </div>
          <DesignSwitcher activeDesign={designId} onChange={handleDesignChange} />
          <div className={styles.topActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setSourceOpen(true)}>
              <FiImage aria-hidden />
              Source
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => handleReserve()}>
              <FiMessageCircle aria-hidden />
              予約
            </button>
          </div>
        </div>
      </header>

      <main key={designId} className={styles.designFrame}>
        {content}
      </main>

      <ReservationDrawer
        open={reservationOpen}
        service={selectedService}
        selectedOptions={selectedOptions}
        selectedOptionIds={selectedOptionIds}
        totalDuration={summary.durationMinutes}
        totalPrice={summary.priceValue}
        contactMethod={contactMethod}
        recommendationNote={recommendation.note}
        onContactMethodChange={setContactMethod}
        onToggleOption={handleToggleOption}
        onCopy={handleCopy}
        onClose={() => setReservationOpen(false)}
      />
      <SourceViewer open={sourceOpen} onClose={() => setSourceOpen(false)} />

      {copyMessage ? (
        <div className={styles.copyToast} role="status">
          {copyMessage}
        </div>
      ) : null}
    </div>
  )
}

function renderDesign(designId: DesignId, props: DemoViewProps) {
  if (designId === 'soft-spa-menu') {
    return <SoftSpaMenu {...props} />
  }

  if (designId === 'consultation-studio') {
    return <ConsultationStudio {...props} />
  }

  if (designId === 'reservation-concierge') {
    return <ReservationConcierge {...props} />
  }

  return <BotanicalFlyer {...props} />
}

function BotanicalFlyer(props: DemoViewProps) {
  return (
    <div className={styles.posterShell}>
      <section className={styles.posterHero}>
        <Image className={styles.heroLogo} src={assets.logo} alt="" width={84} height={84} priority />
        <p className={styles.eyebrow}>{salon.focus}</p>
        <h1>{salon.positioning}</h1>
        <p>{salon.intro}</p>
        <div className={styles.heroActions}>
          <button type="button" className={styles.primaryButton} onClick={() => props.onReserve()}>
            <FiMessageCircle aria-hidden />
            LINE・Instagram予約
          </button>
        </div>
      </section>

      <TrustStrip />

      <section className={styles.posterSection}>
        <ConcernSelector concern={props.concern} recommendation={props.recommendation} onSelect={props.onConcernChange} />
      </section>

      <section className={styles.offerTicket}>
        <div>
          <p className={styles.ticketLabel}>{firstTimeOffer.label}</p>
          <h2>{firstTimeOffer.title}</h2>
          <p>{firstTimeOffer.note}</p>
        </div>
        <div className={styles.ticketPrice}>
          <span>{firstTimeOffer.ribbon}</span>
          <strong>{firstTimeOffer.price}</strong>
          <small>{firstTimeOffer.duration}</small>
        </div>
      </section>

      <section className={styles.posterMenu} aria-label="施術メニュー">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Treatment Menu</p>
          <h2>エクソソーム導入メニュー</h2>
          <p>
            {salon.menuContext}
            <span>{salon.footnote}</span>
          </p>
        </div>
        <ServiceList variant="poster-static" {...props} />
      </section>

      <div className={styles.posterBottomGrid}>
        <OptionPanel selectedOptionIds={props.selectedOptionIds} onToggleOption={props.onToggleOption} totalDuration={props.totalDuration} totalPrice={props.totalPrice} />
        <ContactPanel variant="poster" onReserve={() => props.onReserve()} onCopy={props.onCopy} />
      </div>
    </div>
  )
}

function SoftSpaMenu(props: DemoViewProps) {
  return (
    <div className={styles.softShell}>
      <section className={styles.softHero}>
        <Image className={styles.softLogo} src={assets.logo} alt="" width={62} height={62} priority />
        <p className={styles.eyebrow}>salon sui facial menu</p>
        <h1>うるおいと透明感を整える導入ケア</h1>
        <p>
          {salon.menuContext}
          <span>{salon.footnote}</span>
        </p>
      </section>

      <TrustStrip />

      <section className={styles.softSheet}>
        <ConcernSelector compact concern={props.concern} recommendation={props.recommendation} onSelect={props.onConcernChange} />
        <ServiceList variant="spa-horizontal" {...props} />
        <OptionPanel variant="spa" selectedOptionIds={props.selectedOptionIds} onToggleOption={props.onToggleOption} totalDuration={props.totalDuration} totalPrice={props.totalPrice} />
      </section>

      <ContactPanel variant="soft" onReserve={() => props.onReserve()} onCopy={props.onCopy} />
    </div>
  )
}

function ConsultationStudio(props: DemoViewProps) {
  const selectedService = getServiceById(props.selectedServiceId)

  return (
    <div className={styles.studioShell}>
      <section className={styles.studioGrid}>
        <div className={styles.studioControls}>
          <div className={styles.studioIntro}>
            <p className={styles.eyebrow}>Consultation Studio</p>
            <h1>肌状態に合わせたおすすめを組み立てる</h1>
            <p>{salon.intro}</p>
          </div>

          <div className={styles.mobileStepper} aria-label="相談ステップ">
            {['お悩み', '肌状態', 'おすすめ', '予約'].map((step, index) => (
              <span key={step}>
                {index + 1}. {step}
              </span>
            ))}
          </div>

          <ConcernSelector compact concern={props.concern} recommendation={props.recommendation} onSelect={props.onConcernChange} />

          <ControlGroup title="気になり方" icon={<FiSliders aria-hidden />}>
            <SegmentedButtons values={intensities} value={props.intensity} onChange={props.onIntensityChange} />
          </ControlGroup>

          <ControlGroup title="目指したい印象" icon={<FiStar aria-hidden />}>
            <SegmentedButtons values={skinGoals} value={props.goal} onChange={props.onGoalChange} />
          </ControlGroup>

          <ControlGroup title="お時間の目安" icon={<FiClock aria-hidden />}>
            <SegmentedButtons values={timePreferences} value={props.timePreference} onChange={props.onTimePreferenceChange} />
          </ControlGroup>

          <SkinLayerDiagram />
        </div>

        <aside className={styles.recommendationPanel}>
          <p className={styles.eyebrow}>Recommended Plan</p>
          <h2>{selectedService.name}</h2>
          <p>{props.recommendation.note}</p>
          <div className={styles.planTotals}>
            <span>
              <FiClock aria-hidden />
              {props.totalDuration}分
            </span>
            <strong>{formatYen(props.totalPrice)}</strong>
          </div>
          <OptionPanel
            compact
            selectedOptionIds={props.selectedOptionIds}
            onToggleOption={props.onToggleOption}
            totalDuration={props.totalDuration}
            totalPrice={props.totalPrice}
          />
          <details className={styles.whyPlan} open>
            <summary>Why this plan</summary>
            <p>{selectedService.bestFor}。肌状態を確認し、必要に応じてオプションを調整します。</p>
          </details>
          <button type="button" className={styles.primaryButton} onClick={() => props.onReserve()}>
            <FiMessageCircle aria-hidden />
            この内容で相談する
          </button>
        </aside>
      </section>

      <section className={styles.supportingMenu}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Treatment Evidence</p>
          <h2>メニュー詳細</h2>
        </div>
        <ServiceList variant="compact" {...props} />
      </section>

      <ContactPanel variant="studio" onReserve={() => props.onReserve()} onCopy={props.onCopy} />
    </div>
  )
}

function ReservationConcierge(props: DemoViewProps) {
  const selectedService = getServiceById(props.selectedServiceId)

  return (
    <div className={styles.conciergeShell}>
      <section className={styles.conciergeHero}>
        <div>
          <p className={styles.eyebrow}>Reservation Concierge</p>
          <h1>コースを選び、LINEまたはInstagramで相談</h1>
          <p>{salon.positioning}。{salon.station}、{salon.appointment}のプライベートサロンです。</p>
        </div>
      </section>

      <section className={styles.bookingGrid}>
        <div className={styles.bookingBuilder}>
          <ConcernSelector compact concern={props.concern} recommendation={props.recommendation} onSelect={props.onConcernChange} />

          <section className={styles.coursePicker} aria-label="コース選択">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Course</p>
              <h2>コースを選ぶ</h2>
            </div>
            <div className={styles.coursePickerGrid}>
              {services.map((service) => {
                const selected = props.selectedServiceId === service.id
                const recommended = props.recommendation.serviceId === service.id
                return (
                  <button
                    key={service.id}
                    type="button"
                    className={`${styles.coursePickerCard} ${selected ? styles.coursePickerCardSelected : ''}`}
                    aria-pressed={selected}
                    onClick={() => props.onSelectService(service.id)}>
                    <span className={styles.serviceIcon} aria-hidden>
                      {service.id === 'hand-care' ? <FiStar /> : <FiDroplet />}
                    </span>
                    <strong>{service.name}</strong>
                    <small>{service.bestFor}</small>
                    <span>
                      {service.duration} / {service.price}
                    </span>
                    {recommended ? <em>おすすめ</em> : null}
                  </button>
                )
              })}
            </div>
          </section>

          <OptionPanel selectedOptionIds={props.selectedOptionIds} onToggleOption={props.onToggleOption} totalDuration={props.totalDuration} totalPrice={props.totalPrice} />
        </div>

        <aside className={styles.bookingSummary}>
          <p className={styles.eyebrow}>Your Plan</p>
          <h2>{selectedService.name}</h2>
          <p>{selectedService.description}</p>
          <div className={styles.conciergeTotal}>
            <span>合計 {props.totalDuration}分</span>
            <strong>{formatYen(props.totalPrice)}</strong>
          </div>
          <div className={styles.contactTabs} role="tablist" aria-label="お問い合わせ方法">
            {(['LINE', 'Instagram', 'Access'] as const).map((method) => (
              <button
                key={method}
                type="button"
                role="tab"
                aria-selected={props.contactMethod === method}
                className={props.contactMethod === method ? styles.contactTabActive : ''}
                onClick={() => props.onContactMethodChange(method)}>
                {method}
              </button>
            ))}
          </div>
          <ContactPreview method={props.contactMethod} onCopy={props.onCopy} />
          <button type="button" className={styles.primaryButton} onClick={() => props.onReserve()}>
            予約・相談する
            <FiArrowRight aria-hidden />
          </button>
        </aside>
      </section>

      <ContactPanel variant="concierge" onReserve={() => props.onReserve()} onCopy={props.onCopy} />
    </div>
  )
}

function ServiceList({ variant, ...props }: DemoViewProps & { variant: 'poster' | 'poster-static' | 'spa' | 'spa-horizontal' | 'compact' }) {
  return (
    <div className={`${styles.serviceList} ${variant === 'spa' ? styles.serviceListSpa : ''}`}>
      {services.map((service, index) => (
        <ServiceCard
          key={service.id}
          service={service}
          index={index}
          variant={variant}
          recommended={props.recommendation.serviceId === service.id}
          selected={props.selectedServiceId === service.id}
          expanded={props.expandedServiceId === service.id}
          suggestedOption={service.suggestedOptionId ? getOptionById(service.suggestedOptionId) : undefined}
          onToggle={() => props.onToggleService(service.id)}
          onSelect={() => props.onSelectService(service.id)}
          onReserve={() => props.onReserve(service.id)}
        />
      ))}
    </div>
  )
}

function OptionPanel({
  selectedOptionIds,
  onToggleOption,
  totalDuration,
  totalPrice,
  compact = false,
  variant
}: {
  selectedOptionIds: OptionId[]
  onToggleOption: (optionId: OptionId) => void
  totalDuration: number
  totalPrice: number
  compact?: boolean
  variant?: 'spa'
}) {
  return (
    <section className={`${styles.optionPanel} ${compact ? styles.optionPanelCompact : ''}`} aria-label="オプション">
      <div className={styles.optionPanelHeader}>
        <div>
          <p className={styles.eyebrow}>Add-on</p>
          <h2>オプション</h2>
        </div>
        <p>
          合計 {totalDuration}分 / {formatYen(totalPrice)}
        </p>
      </div>
      {variant === 'spa' ? (
        <div className={styles.optionLeaderList}>
          {options.map((option) => {
            const selected = selectedOptionIds.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                className={`${styles.optionLeader} ${selected ? styles.optionToggleActive : ''}`}
                aria-pressed={selected}
                onClick={() => onToggleOption(option.id)}>
                <span>{selected ? <FiCheck aria-hidden /> : <FiPlus aria-hidden />}</span>
                <strong>{option.name}</strong>
                <span className={styles.dottedLeader} aria-hidden />
                <small>{option.duration}</small>
                <span>{option.price}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className={styles.optionGrid}>
          {options.map((option) => {
            const selected = selectedOptionIds.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                className={`${styles.optionToggle} ${selected ? styles.optionToggleActive : ''}`}
                aria-pressed={selected}
                onClick={() => onToggleOption(option.id)}>
                <span>{selected ? <FiCheck aria-hidden /> : <FiPlus aria-hidden />}</span>
                <strong>{option.name}</strong>
                <small>
                  {option.duration} / {option.price}
                </small>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ControlGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={styles.controlGroup}>
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function SegmentedButtons<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className={styles.segmentedButtons} role="group">
      {values.map((entry) => (
        <button key={entry} type="button" aria-pressed={value === entry} className={value === entry ? styles.segmentActive : ''} onClick={() => onChange(entry)}>
          {entry}
        </button>
      ))}
    </div>
  )
}

function SkinLayerDiagram() {
  return (
    <section className={styles.skinDiagram} aria-label="美容成分の導入イメージ">
      <div className={styles.skinDiagramHeader}>
        <FiLayers aria-hidden />
        <span>美容成分 → 角質層まで</span>
      </div>
      <div className={styles.skinLayers} aria-hidden>
        <span />
        <span />
        <span />
        <i />
      </div>
      <p>化粧品としての導入ケア表現に留め、肌状態に合わせて施術をご提案します。</p>
    </section>
  )
}

function ContactPreview({ method, onCopy }: { method: 'LINE' | 'Instagram' | 'Access'; onCopy: (value: string, label: string) => void }) {
  return (
    <div className={styles.conciergeContactPreview}>
      <div className={styles.conciergeQr}>
        <Image src={assets.accessCard} alt="Instagram QR、LINE QR、アクセス地図が載ったカード" width={600} height={1050} />
      </div>
      {method === 'Instagram' ? (
        <p>
          <FiInstagram aria-hidden />
          {salon.instagram}
          <button type="button" aria-label="Instagram IDをコピー" onClick={() => onCopy(salon.instagram, 'Instagram ID')}>
            <FiCopy aria-hidden />
          </button>
        </p>
      ) : null}
      {method === 'Access' ? (
        <p>
          <FiMapPin aria-hidden />
          {salon.address}
          <button type="button" aria-label="住所をコピー" onClick={() => onCopy(salon.address, '住所')}>
            <FiCopy aria-hidden />
          </button>
        </p>
      ) : null}
      {method === 'LINE' ? (
        <p>
          <FiMessageCircle aria-hidden />
          LINE QRからお問い合わせください。
        </p>
      ) : null}
    </div>
  )
}

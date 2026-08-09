import { KarakeepSettings } from '@/components/ui/KarakeepSettings';

/** Renders browser-local third-party integration settings. */
export default function IntegrationsPage() {
  return (
    <div className="integrations-page">
      <header className="timeline-header">
        <div className="timeline-shell timeline-header__inner">
          <div className="timeline-header__copy">
            <p className="timeline-header__eyebrow">Settings</p>
            <h1 className="timeline-header__title">Integrations</h1>
            <p className="timeline-header__subtitle">
              Connect browser-local services to your reading workflow
            </p>
          </div>
        </div>
      </header>

      <div className="timeline-shell integrations-page__content">
        <KarakeepSettings />
      </div>
    </div>
  );
}

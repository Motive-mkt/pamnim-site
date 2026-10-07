import LeadQualifyingForm from './LeadQualifyingForm';

// The option lists live with the shared form; re-exported so existing imports keep working
export { PROPERTY_STATUS_OPTIONS, PROJECT_SCOPE_OPTIONS } from './LeadQualifyingForm';

/** Homepage consultation form: the shared lead form in its hero presentation */
export default function HeroContactForm() {
  return <LeadQualifyingForm variant="hero" source="hero_lead_form" />;
}

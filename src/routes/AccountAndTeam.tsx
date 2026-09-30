// Account and team on one page (inside a wedding): your profile, your weddings, sign-out,
// then the team for this wedding — editable for owners, read-only for everyone else.
import { SectionTitle } from '@/components/kit';
import { AccountSections } from './Account';
import { Team } from './Team';

export function AccountAndTeam() {
  return (
    <div>
      <SectionTitle sub="Your profile and sign-in, and who else is planning this wedding with you.">Account &amp; team</SectionTitle>
      <AccountSections wide />
      <Team />
    </div>
  );
}

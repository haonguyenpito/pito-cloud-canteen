import MetaWrapper from '@components/MetaWrapper/MetaWrapper';

import ManageCompanyParticipantsPage from './ManageCompanyParticipants.page';

export default function AdminCompanyParticipantsRoute() {
  return (
    <MetaWrapper routeName="AdminCompanyParticipantsRoute">
      <ManageCompanyParticipantsPage />
    </MetaWrapper>
  );
}

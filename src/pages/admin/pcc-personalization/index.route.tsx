import MetaWrapper from '@components/MetaWrapper/MetaWrapper';

import PCCPersonalization from './PCCPersonalization.page';

export default function PCCPersonalizationRoute() {
  return (
    <MetaWrapper
      title="PCC Personalization"
      description="PITO Cloud Canteen Participant Personalization">
      <PCCPersonalization />
    </MetaWrapper>
  );
}

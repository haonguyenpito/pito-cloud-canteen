import MetaWrapper from '@components/MetaWrapper/MetaWrapper';

import PCCPersonalization from './PCCPersonalization.page';

export default function PersonalizationRoute() {
  const env = process.env.NEXT_PUBLIC_ENV;
  if (env !== 'production') {
    return <div>Personalization dashboard</div>;
  }

  return (
    <MetaWrapper
      title="Personalization dashboard"
      description="PITO Cloud Canteen Participant Personalization">
      <PCCPersonalization />
    </MetaWrapper>
  );
}

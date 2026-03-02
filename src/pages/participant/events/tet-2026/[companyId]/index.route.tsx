import React from 'react';
import { useRouter } from 'next/router';

import MetaWrapper from '@components/MetaWrapper/MetaWrapper';

import TetPage from './Tet.page';

const TetPageRoute = () => {
  const router = useRouter();
  const { companyId } = router.query;

  return (
    <MetaWrapper>
      <TetPage companyId={companyId as string} />
    </MetaWrapper>
  );
};

export default TetPageRoute;

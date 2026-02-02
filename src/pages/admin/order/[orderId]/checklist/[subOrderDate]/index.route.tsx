import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';

import IconArrow from '@components/Icons/IconArrow/IconArrow';
import MetaWrapper from '@components/MetaWrapper/MetaWrapper';
import { adminPaths } from '@src/paths';

import CheckListPage from './CheckList.page';

export default function CheckListRoute() {
  const router = useRouter();
  const { orderId, subOrderDate } = router.query as {
    orderId: string;
    subOrderDate: string;
  };

  const handleGoBack = () => {
    router.push(adminPaths.OrderDetail.replace('[orderId]', orderId));
  };

  return (
    <MetaWrapper routeName="AdminCheckListRoute">
      <div className="sticky top-0 z-10 bg-white py-3 px-6 border-b border-gray-300 shadow-sm flex items-center justify-center min-h-12">
        <div
          className="absolute left-10 flex items-center gap-2 cursor-pointer text-base font-semibold leading-6 text-gray-700 hover:opacity-80"
          onClick={handleGoBack}>
          <IconArrow direction="left" />
        </div>
        <div className="flex justify-center items-center">
          <Image
            src="/static/icons/logo.png"
            alt="logo"
            width={100}
            height={100}
            className="h-8 w-auto"
          />
        </div>
      </div>
      <CheckListPage orderId={orderId} subOrderDate={subOrderDate} />
    </MetaWrapper>
  );
}

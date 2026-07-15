import React from 'react';
import { useIntl } from 'react-intl';
import { useRouter } from 'next/router';

import Button from '@components/Button/Button';
import PitoLogo from '@components/PitoLogo/PitoLogo';
import { useLogout } from '@hooks/useLogout';
import { enGeneralPaths } from '@src/paths';

import css from './InActiveUserScreen.module.scss';

type TInActiveUserScreenProps = {
  /**
   * `inactive` = company still awaiting activation (the pre-existing case).
   * `disabled` = account locked by an admin.
   */
  variant?: 'inactive' | 'disabled';
};

const UnActiveUserScreen: React.FC<TInActiveUserScreenProps> = ({
  variant = 'inactive',
}) => {
  const handleLogoutFn = useLogout();
  const router = useRouter();
  const intl = useIntl();

  const handleLogout = async () => {
    await handleLogoutFn();
    router.push(enGeneralPaths.Auth);
  };

  const messageId =
    variant === 'disabled'
      ? 'tai-khoan-cua-ban-da-bi-khoa'
      : 'tai-khoan-cua-ban-chua-duoc-kich-hoat';

  return (
    <div className={css.root}>
      <PitoLogo />
      <p className="my-2">{intl.formatMessage({ id: messageId })}</p>
      <Button type="button" onClick={handleLogout}>
        {intl.formatMessage({ id: 'CompanyHeaderMobile.logout' })}
      </Button>
    </div>
  );
};

export default UnActiveUserScreen;

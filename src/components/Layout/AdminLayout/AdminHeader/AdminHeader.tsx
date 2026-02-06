// eslint-disable-next-line import/no-named-as-default
import React from 'react';
import { MenuIcon } from 'lucide-react';
import { useRouter } from 'next/router';

import Avatar from '@components/Avatar/Avatar';
import { InlineTextButton } from '@components/Button/Button';
import IconArrow from '@components/Icons/IconArrow/IconArrow';
import { cn } from '@components/lib/utils';
import PitoLogo from '@components/PitoLogo/PitoLogo';
import ProfileMenu from '@components/ProfileMenu/ProfileMenu';
import ProfileMenuContent from '@components/ProfileMenuContent/ProfileMenuContent';
import ProfileMenuItem from '@components/ProfileMenuItem/ProfileMenuItem';
import ProfileMenuLabel from '@components/ProfileMenuLabel/ProfileMenuLabel';
import { useAppSelector } from '@hooks/reduxHooks';
import { useLogout } from '@hooks/useLogout';
import { currentUserSelector } from '@redux/slices/user.slice';
import { enGeneralPaths } from '@src/paths';
import { CurrentUser } from '@src/utils/data';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';

import css from './AdminHeader.module.scss';

type TAdminHeaderProps = {
  onMenuClick: () => void;
};

const AdminHeader: React.FC<TAdminHeaderProps> = ({ onMenuClick }) => {
  const currentUser = useAppSelector(currentUserSelector);
  const router = useRouter();
  const handleLogoutFn = useLogout();

  const currentUserGetter = CurrentUser(currentUser);
  const {
    lastName = '',
    firstName = '',
    displayName,
  } = currentUserGetter.getProfile();
  const currentUserFullName = buildFullName(firstName, lastName, {
    compareToGetLongerWith: displayName,
  });

  const onLogout = async () => {
    await handleLogoutFn();
    router.push(enGeneralPaths.Auth);
  };

  return (
    <div className={css.root}>
      <div className={css.headerRight}>
        <InlineTextButton
          type="button"
          onClick={onMenuClick}
          className={css.menuButton}>
          <MenuIcon className={cn(css.iconMenu, 'text-black')} />
        </InlineTextButton>
        <PitoLogo className={css.logo} />
      </div>
      <div className={css.headerLeft}>
        {/* <InlineTextButton type="button">
          <IconBell className={css.iconBell} />
        </InlineTextButton> */}
        <div className={css.line}></div>
        <ProfileMenu>
          <ProfileMenuLabel className={css.profileMenuWrapper}>
            <div className={css.avatar}>
              <Avatar disableProfileLink user={currentUser} />
            </div>
            <p className={css.displayName}>{currentUserFullName}</p>
            <IconArrow direction="down" />
          </ProfileMenuLabel>
          <ProfileMenuContent className={css.profileMenuContent}>
            <ProfileMenuItem key="AccountSettingsPage">
              <InlineTextButton type="button" onClick={onLogout}>
                <p>Đăng xuất</p>
              </InlineTextButton>
            </ProfileMenuItem>
          </ProfileMenuContent>
        </ProfileMenu>
      </div>
    </div>
  );
};

export default AdminHeader;

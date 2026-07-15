import type { PropsWithChildren } from 'react';
import React from 'react';

import FullScreenPageLoading from '@components/FullScreenPageLoading/FullScreenPageLoading';
import InActiveUserScreen from '@components/InActiveUserScreen/InActiveUserScreen';
import RoleSelectModal from '@components/RoleSelectModal/RoleSelectModal';
import { useAppSelector } from '@hooks/reduxHooks';
import { useRoleSelectModalController } from '@hooks/useRoleSelectModalController';

import { getLayoutBaseOnPermission } from './Guards.helper';
import { useAccessRouteBaseOnRoles } from './useAccessRouteBaseOnRoles';
import useActiveCompany from './useActiveCompany';
import useVerifyPermission from './useVerifyPermission';

type TPermissionGuardGuardProps = PropsWithChildren<{}>;

const PermissionGuard: React.FC<TPermissionGuardGuardProps> = (props) => {
  const { children } = props;
  useAccessRouteBaseOnRoles();
  const { isIgnoredPermissionCheck, userPermission, isMatchedPermission } =
    useVerifyPermission();
  const { isAuthenticated, authInfoLoaded } = useAppSelector(
    (state) => state.auth,
  );
  const { currentUserInProgress: currentUserIsLoading } = useAppSelector(
    (state) => state.user,
  );
  const { isInactiveCompany, isDisabledUser } = useActiveCompany();
  const { isRoleSelectModalOpen, onCloseRoleSelectModal } =
    useRoleSelectModalController();

  const renderComponent = () => {
    if (isIgnoredPermissionCheck) {
      return children;
    }

    if (isDisabledUser) {
      return <InActiveUserScreen variant="disabled" />;
    }

    if (isInactiveCompany) {
      return <InActiveUserScreen />;
    }

    const LayoutWrapper = getLayoutBaseOnPermission(userPermission);

    return !authInfoLoaded || currentUserIsLoading ? (
      <FullScreenPageLoading />
    ) : isMatchedPermission && isAuthenticated ? (
      <LayoutWrapper>{children}</LayoutWrapper>
    ) : (
      children
    );
  };

  return (
    <>
      {renderComponent()}
      <RoleSelectModal
        isOpen={isRoleSelectModalOpen}
        handleClose={onCloseRoleSelectModal}
      />
    </>
  );
};

export default PermissionGuard;

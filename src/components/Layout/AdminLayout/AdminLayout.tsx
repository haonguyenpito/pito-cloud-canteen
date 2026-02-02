import type { PropsWithChildren } from 'react';
import { useRouter } from 'next/router';

import useBoolean from '@hooks/useBoolean';

import AdminHeader from './AdminHeader/AdminHeader';
import AdminLayoutContent from './AdminLayoutContent/AdminLayoutContent';
import AdminLayoutSidebar from './AdminLayoutSidebar/AdminLayoutSidebar';
import AdminLayoutTopbar from './AdminLayoutTopbar/AdminLayoutTopbar';
import AdminLayoutWrapper from './AdminLayoutWrapper/AdminLayoutWrapper';
import AdminSidebar from './AdminSidebar/AdminSidebar';

const AdminLayout: React.FC<PropsWithChildren> = (props) => {
  const { children } = props;
  const {
    value: isMenuOpen,
    setFalse: onCloseMenu,
    toggle: toggleMenuOpen,
  } = useBoolean(false);
  const { pathname } = useRouter();

  if (pathname.includes('scanner') || pathname.includes('checklist')) {
    return (
      <div className="w-full mx-auto bg-[#F7E1EB] min-h-screen">{children}</div>
    );
  }

  return (
    <AdminLayoutWrapper>
      <AdminLayoutTopbar>
        <AdminHeader onMenuClick={toggleMenuOpen} />
      </AdminLayoutTopbar>
      <AdminLayoutSidebar isMenuOpen={isMenuOpen}>
        <AdminSidebar onCloseMenu={onCloseMenu} onMenuClick={toggleMenuOpen} />
      </AdminLayoutSidebar>
      <AdminLayoutContent isMenuOpen={isMenuOpen}>
        {children}
      </AdminLayoutContent>
    </AdminLayoutWrapper>
  );
};

export default AdminLayout;

import MetaWrapper from '@components/MetaWrapper/MetaWrapper';

import AdminDashboard from './AdminDashboard.page';

export default function AdminHomePageRoute() {
  const env = process.env.NEXT_PUBLIC_ENV;
  if (env !== 'production') {
    return <div>Dashboard</div>;
  }

  return (
    <MetaWrapper routeName="AdminHomePageRoute">
      <AdminDashboard />
    </MetaWrapper>
  );
}

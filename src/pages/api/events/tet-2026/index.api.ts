import type { NextApiRequest, NextApiResponse } from 'next';

import { getIntegrationSdk } from '@services/integrationSdk';
import { createNativeNotification } from '@services/nativeNotification';
import { ENativeNotificationType } from '@src/utils/enums';

export async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  if (method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const { companyIds } = req.body;
  const integrationSdk = getIntegrationSdk();
  const companies = await Promise.all(
    companyIds.map(async (companyId: string) => {
      const company = await integrationSdk.companies.show({
        id: companyId,
      });

      return company;
    }),
  );
  await Promise.allSettled(
    companies.map(async (company) => {
      const members = company.attributes.metadata.members;
      await createNativeNotification(ENativeNotificationType.Tet2026, {
        participantId: members.oneSignalUserId,
        companyId: company.id,
      });
    }),
  );

  console.log(companyIds);

  return res.status(200).json({ message: 'Hello, world!' });
}

import type { NextApiRequest, NextApiResponse } from 'next';
import pLimit from 'p-limit';

import { getIntegrationSdk } from '@services/integrationSdk';
import { createNativeNotification } from '@services/nativeNotification';
import { denormalisedResponseEntities } from '@src/utils/data';
import { ENativeNotificationType } from '@src/utils/enums';

const NOTIFICATION_CONCURRENCY = 50;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  if (method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { companyIds } = req.body;
  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return res.status(400).json({
      message: 'companyIds must be a non-empty array',
    });
  }

  const integrationSdk = getIntegrationSdk();
  const companyResults = await Promise.allSettled(
    companyIds.map(async (companyId: string) => {
      const company = await integrationSdk.users.show({
        id: companyId,
      });
      const [companyUser] = denormalisedResponseEntities(company);

      return companyUser;
    }),
  );

  const companiesFetched = companyResults.filter(
    (r) => r.status === 'fulfilled',
  ).length;
  const companiesFailed = companyResults.filter(
    (r) => r.status === 'rejected',
  ).length;
  if (companiesFailed > 0) {
    companyResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(
          `[Tet2026] Failed to fetch company ${companyIds[i]}:`,
          r.reason,
        );
      }
    });
  }

  const companies = companyResults
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Awaited<ReturnType<typeof denormalisedResponseEntities>[0]>
      > => r.status === 'fulfilled',
    )
    .map((r) => r.value);

  const limit = pLimit(NOTIFICATION_CONCURRENCY);
  const notificationPromises = companies.flatMap((company) =>
    Object.entries(company.attributes.profile.metadata.members)
      .filter(([_email, member]) => (member as { id: string })?.id)
      .map(([_email, member]) =>
        limit(() =>
          createNativeNotification(ENativeNotificationType.Tet2026, {
            participantId: (member as { id: string }).id,
            companyId: company.id,
          }),
        ),
      ),
  );

  const notificationResults = await Promise.allSettled(notificationPromises);
  const notificationsSent = notificationResults.filter(
    (r) => r.status === 'fulfilled',
  ).length;
  const notificationsFailed = notificationResults.filter(
    (r) => r.status === 'rejected',
  ).length;
  if (notificationsFailed > 0) {
    notificationResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[Tet2026] Notification failed (index ${i}):`, r.reason);
      }
    });
  }

  return res.status(200).json({
    message: 'Batch completed',
    companiesFetched,
    companiesFailed,
    notificationsSent,
    notificationsFailed,
  });
};

export default handler;

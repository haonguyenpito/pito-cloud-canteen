import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import orderServices from '@pages/api/apiServices/order/index.service';
import cookies from '@services/cookie';
import { fetchUser } from '@services/integrationHelper';
import { getCurrentUser, handleError } from '@services/sdk';
import type { UserListing } from '@src/types';
import { CurrentUser, User } from '@src/utils/data';

const showUserMaybe = (id: string) => {
  try {
    return fetchUser(id);
  } catch (error) {
    return null;
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const apiMethod = req.method;

    switch (apiMethod) {
      case HttpMethod.POST: {
        try {
          const { planId } = req.query;
          const createData = req.body;
          const {
            currentUser,
          }: {
            currentUser: UserListing;
          } = await getCurrentUser(req, res);
          const createdAt = createData?.createdAt
            ? new Date(createData.createdAt)
            : new Date();
          const response =
            await orderServices.createSubOrderHistoryRecordToFirestore({
              planId,
              authorId: CurrentUser(currentUser as any).getId(),
              ...createData,
              authorRole: currentUser.attributes?.profile?.metadata?.isAdmin
                ? 'admin'
                : 'booker',
              createdAt,
            });

          return res.status(200).json(response);
        } catch (error) {
          console.error(
            '/orders/[orderId]/plan/[planId]/history error:',
            error,
          );

          return res.status(500).json(error);
        }
      }
      case HttpMethod.GET: {
        try {
          const {
            planId,
            planOrderDate,
            limitRecords = 3,
            lastRecordCreatedAt,
          } = req.query;

          const results = await orderServices.querySubOrderHistoryFromFirebase({
            planId: planId as string,
            planOrderDate: Number(planOrderDate),
            limitRecords: Number(limitRecords),
            lastRecord: Number(lastRecordCreatedAt),
          });

          const collectionCount = await orderServices.getSubOrderHistoryCount({
            planId: planId as string,
            planOrderDate: Number(planOrderDate),
          });

          const response = await Promise.all(
            results.map(async (item) => {
              const member = item.memberId
                ? await showUserMaybe(item.memberId)
                : null;

              return {
                ...item,
                ...(member
                  ? {
                      member: {
                        email: User(member).getAttributes().email,
                      },
                    }
                  : {}),
              };
            }),
          );

          return res.status(200).json({
            data: response,
            totalItems: collectionCount,
          });
        } catch (error) {
          console.error(error);

          return res.status(500).json(error);
        }
      }
      case HttpMethod.DELETE:
      case HttpMethod.PUT:
      default:
        return res.status(400).json('Method is not allowed');
    }
  } catch (error) {
    console.error(error);
    handleError(res, error);
  }
}

export default cookies(handler);

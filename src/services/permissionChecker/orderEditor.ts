import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

import { EHttpStatusCode } from '@apis/errors';
import { fetchListing } from '@services/integrationHelper';
import { getSdk, handleError } from '@services/sdk';
import { CompanyPermissions } from '@src/types/UserPermission';
import {
  CurrentUser,
  denormalisedResponseEntities,
  Listing,
} from '@utils/data';

/** Admins, or a booker/owner of the company that owns `req.query.orderId`. */
const orderEditorChecker =
  (handler: NextApiHandler) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const [currentUser] = denormalisedResponseEntities(
        await getSdk(req, res).currentUser.show(),
      );
      if (!currentUser) {
        return res
          .status(EHttpStatusCode.Unauthorized)
          .json({ message: 'Unauthenticated!' });
      }

      const { isAdmin = false, company = {} } =
        CurrentUser(currentUser).getMetadata();

      if (!isAdmin) {
        const { companyId } = Listing(
          await fetchListing(req.query.orderId as string),
        ).getMetadata();

        if (!CompanyPermissions.includes(company[companyId]?.permission)) {
          return res.status(EHttpStatusCode.Forbidden).json({
            message: "You don't have permission to access this api!",
          });
        }
      }

      return handler(req, res);
    } catch (error) {
      handleError(res, error);
    }
  };

export default orderEditorChecker;

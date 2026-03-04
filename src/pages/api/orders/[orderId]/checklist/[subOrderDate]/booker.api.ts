import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { adminQueryListings } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import {
  FailedResponse,
  HttpStatus,
  SuccessResponse,
} from '@src/utils/response';
import { EListingType } from '@utils/enums';

type TUpdateClientSignatureBody = {
  clientSignature: string;
  clientNameSignature: string;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  const { orderId, subOrderDate } = req.query as {
    orderId: string;
    subOrderDate: string;
  };

  if (!orderId || !subOrderDate) {
    return res.status(400).json({
      error: 'Order ID and sub order date are required',
    });
  }

  switch (apiMethod) {
    case HttpMethod.GET: {
      try {
        const [checklist] = await adminQueryListings({
          meta_orderId: orderId,
          meta_subOrderDate: subOrderDate,
          meta_listingType: EListingType.checklist,
        });

        return new SuccessResponse({
          data: checklist ?? null,
          status: HttpStatus.OK,
        }).send(res);
      } catch (error) {
        return new FailedResponse({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Get checklist failed',
        }).send(res);
      }
    }

    case 'PATCH': {
      try {
        const { clientSignature, clientNameSignature } =
          req.body as TUpdateClientSignatureBody;

        if (!clientSignature || !clientNameSignature) {
          return new FailedResponse({
            status: HttpStatus.BAD_REQUEST,
            message: 'clientSignature and clientNameSignature are required',
          }).send(res);
        }

        const [checklist] = await adminQueryListings({
          meta_orderId: orderId,
          meta_subOrderDate: subOrderDate,
          meta_listingType: EListingType.checklist,
        });

        if (!checklist?.id?.uuid) {
          return new FailedResponse({
            status: HttpStatus.NOT_FOUND,
            message: 'Checklist not found',
          }).send(res);
        }

        const integrationSdk = getIntegrationSdk();
        const metadata = checklist.attributes?.metadata || {};
        const updatedMetadata = {
          ...metadata,
          clientSignature,
          clientNameSignature,
        };

        await integrationSdk.listings.update({
          id: checklist.id.uuid,
          metadata: updatedMetadata,
        });

        const [updatedChecklist] = await adminQueryListings({
          meta_orderId: orderId,
          meta_subOrderDate: subOrderDate,
          meta_listingType: EListingType.checklist,
        });

        return new SuccessResponse({
          data: updatedChecklist ?? null,
          status: HttpStatus.OK,
        }).send(res);
      } catch (error) {
        return new FailedResponse({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Update checklist failed`,
        }).send(res);
      }
    }

    default:
      return new FailedResponse({
        status: HttpStatus.NOT_FOUND,
        message: 'Method not allowed',
      }).send(res);
  }
};

// Public API - no auth checker
export default cookies(handler);

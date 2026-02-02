import type { NextApiRequest, NextApiResponse } from 'next';

import { HttpMethod } from '@apis/configs';
import cookies from '@services/cookie';
import { denormalisedResponseEntities } from '@services/data';
import adminChecker from '@services/permissionChecker/admin';
import { getIntegrationSdk, getSdk } from '@services/sdk';
import {
  FailedResponse,
  HttpStatus,
  SuccessResponse,
} from '@src/utils/response';
import { EListingStates, EListingType } from '@utils/enums';
import type { TCreateChecklistApiBody } from '@utils/types';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiMethod = req.method;
  const { orderId, subOrderDate } = req.query as {
    orderId: string;
    subOrderDate: string;
  };
  switch (apiMethod) {
    case HttpMethod.GET:
      try {
        const sdk = await getSdk(req, res);
        if (!orderId || !subOrderDate) {
          return res
            .status(400)
            .json({ error: 'Order ID and sub order date are required' });
        }
        const checklistResponse = await sdk.listings.query({
          meta_orderId: orderId,
          meta_subOrderDate: subOrderDate,
          meta_listingType: EListingType.checklist,
        });
        const [checklist] = denormalisedResponseEntities(checklistResponse);

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
    case HttpMethod.POST:
      try {
        const integrationSdk = getIntegrationSdk();
        const sdk = getSdk(req, res);
        const {
          implementationDate,
          recordedTime,
          responsibleStaffName,
          clientName,
          orderCode,
          partnerName,
          foodTakenOutTime,
          foodSafetyTime,
          images,
          qaQcSignature,
          qaQcName,
          partnerSignature,
          partnerNameSignature,
          clientSignature,
          clientNameSignature,
        } = req.body as TCreateChecklistApiBody;
        if (
          !implementationDate ||
          !recordedTime ||
          !responsibleStaffName ||
          !clientName ||
          !orderCode ||
          !partnerName ||
          !foodTakenOutTime ||
          !foodSafetyTime ||
          !images ||
          !Array.isArray(images) ||
          !qaQcSignature ||
          !qaQcName
        ) {
          return new FailedResponse({
            status: HttpStatus.BAD_REQUEST,
            message: 'Missing required fields',
          }).send(res);
        }

        // Transform images to include uploadedAt timestamp if not present
        const imagesWithTimestamp = images.map((img) => ({
          imageUrl: img.imageUrl,
          imageId: img.imageId,
          uploadedAt: img.uploadedAt || Date.now(),
        }));
        const [currentUser] = denormalisedResponseEntities(
          await sdk.currentUser.show(),
        );
        const { subAccountId } = currentUser.attributes.profile.privateData;
        const checklistResponse = await integrationSdk.listings.create({
          title: `Checklist for ${orderCode} - ${subOrderDate}`,
          authorId: subAccountId,
          state: EListingStates.published,
          metadata: {
            listingType: EListingType.checklist,
            orderId,
            subOrderDate,
            implementationDate,
            recordedTime,
            responsibleStaffName,
            clientName,
            orderCode,
            partnerName,
            foodTakenOutTime,
            foodSafetyTime,
            images: imagesWithTimestamp,
            qaQcSignature,
            qaQcName,
            partnerSignature,
            partnerNameSignature,
            clientSignature,
            clientNameSignature,
          },
        });
        const [checklist] = denormalisedResponseEntities(checklistResponse);

        return new SuccessResponse({
          data: checklist ?? null,
          status: HttpStatus.CREATED,
        }).send(res);
      } catch (error) {
        return new FailedResponse({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Create checklist failed: ${error}`,
        }).send(res);
      }
    default:
      return new FailedResponse({
        status: HttpStatus.NOT_FOUND,
        message: 'Method not allowed',
      }).send(res);
  }
};

export default cookies(adminChecker(handler));

import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import type {
  Address,
  AddressList,
  Body,
  MessageData,
  SendEmailRequest,
} from 'aws-sdk/clients/ses';

import logger from '@helpers/logger';

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },
});

export const createEmailParams = (
  receiver: AddressList,
  subject: MessageData,
  content: MessageData,
  sender: Address,
) => {
  const toAddresses = Array.isArray(receiver) ? receiver : [receiver];
  const body: Body = {
    Html: {
      Charset: 'UTF-8',
      Data: content,
    },
  };

  const emailSender = sender || process.env.AWS_SENDER_EMAIL!;
  const senderName = 'PITO Cloud Canteen';
  const source = `${senderName} <${emailSender}>`;

  const emailParams: SendEmailRequest = {
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Body: body,
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: source,
  };

  return emailParams;
};

export const sendEmail = (params: SendEmailRequest) => {
  sesClient
    .send(new SendEmailCommand(params))
    .then(() => {
      logger.success(
        `Send email to ${params.Destination.ToAddresses} success`,
        params.Message.Subject.Data,
      );
    })
    .catch((error) => {
      logger.error(
        `Send email to ${params.Destination.ToAddresses} failed`,
        String(error),
      );
    });
};

export const sendIndividualEmail = ({
  receiver,
  subject,
  content,
  sender,
}: {
  receiver: AddressList | string;
  subject: MessageData;
  content: MessageData;
  sender: Address;
}) => {
  const receivers = Array.isArray(receiver) ? receiver : [receiver];

  receivers.forEach((email) => {
    const params = createEmailParams([email], subject, content, sender);
    sendEmail(params);
  });
};

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const client = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const BUS_NAME = process.env.EVENTBRIDGE_BUS_NAME || 'photovault-events';

export async function publishPhotoEvents(events: { source: string; detailType: string; detail: object }[]): Promise<void> {
  if (events.length === 0) return;

  // EventBridge max 10 entries per call
  for (let i = 0; i < events.length; i += 10) {
    const batch = events.slice(i, i + 10);
    await client.send(new PutEventsCommand({
      Entries: batch.map(e => ({
        EventBusName: BUS_NAME,
        Source: e.source,
        DetailType: e.detailType,
        Detail: JSON.stringify(e.detail),
      })),
    }));
  }
}

export async function publishHeicConvert(s3Key: string, photoId: string, userId: string): Promise<void> {
  await publishPhotoEvents([{
    source: 'photovault.api',
    detailType: 'heic.convert',
    detail: { s3Key, photoId, userId },
  }]);
}

export async function publishFaceDetect(s3Key: string, photoId: string, userId: string): Promise<void> {
  await publishPhotoEvents([{
    source: 'photovault.api',
    detailType: 'face.detect',
    detail: { s3Key, photoId, userId },
  }]);
}

/**
 * PhotoVault — Share all your albums with another user
 *
 * No S3 uploads. No new records. Just adds the target userId to sharedWith
 * on every album you own. Zero extra cost.
 *
 * Usage:
 *   node share-albums.mjs <wife-userId>
 *
 * Example:
 *   node share-albums.mjs abc123-def456-...
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';

const REGION       = 'us-east-1';
const AWS_PROFILE  = 'photovault-akhil-app-user';
const ALBUMS_TABLE = 'photovault-albums-prod-v1';
const OWNER_ID     = '0781902a-65a7-42df-b0bf-840af42ef879';

const targetUserId = process.argv[2];
if (!targetUserId) {
  console.error('Usage: node share-albums.mjs <wife-userId>');
  console.error('\nTo find her userId: after she signs up, go to AWS Console →');
  console.error('DynamoDB → photovault-users-prod-v1 → scan for her email.');
  process.exit(1);
}

const credentials = fromIni({ profile: AWS_PROFILE });
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION, credentials }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// Fetch all albums owned by you
let albums = [];
let lastKey;
do {
  const res = await dynamo.send(new QueryCommand({
    TableName: ALBUMS_TABLE,
    IndexName: 'userId-createdAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': OWNER_ID },
    ExclusiveStartKey: lastKey,
  }));
  albums.push(...(res.Items ?? []));
  lastKey = res.LastEvaluatedKey;
} while (lastKey);

console.log(`\nFound ${albums.length} albums owned by you.\n`);

let shared = 0, skipped = 0;

for (const album of albums) {
  const already = (album.sharedWith ?? []).some(s => s.userId === targetUserId);
  if (already) {
    console.log(`  ⏭  already shared: "${album.title}"`);
    skipped++;
    continue;
  }

  const updated = [
    ...(album.sharedWith ?? []),
    { userId: targetUserId, permission: 'view', sharedAt: new Date().toISOString() },
  ];

  await dynamo.send(new UpdateCommand({
    TableName: ALBUMS_TABLE,
    Key: { albumId: album.albumId },
    UpdateExpression: 'SET sharedWith = :sw, updatedAt = :now',
    ExpressionAttributeValues: { ':sw': updated, ':now': new Date().toISOString() },
  }));

  console.log(`  ✓  shared: "${album.title}"`);
  shared++;
}

console.log(`\nDone. ${shared} albums shared, ${skipped} already had access.`);
console.log('No S3 uploads — zero extra cost.');

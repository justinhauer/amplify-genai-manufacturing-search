/* AWS CDK LIBRARIES FOR BUILDING A SEARCH ENGINE */
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless'

// /* !! REMOVE COMMENTS ON CODE BELOW FOR SECOND DEPLOYMENT !! */

// /* AWS CDK LIBRARIES FOR BEDROCK AND PERMISSIONS */
// import * as bedrock from 'aws-cdk-lib/aws-bedrock';
// import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

/* AWS AMPLIFY LIBRARIES BACKEND DEFINITIONS */
import { defineBackend } from '@aws-amplify/backend';
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { generateHaikuFunction } from './functions/generateFunction/resource';
import { storage } from './storage/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  generateHaikuFunction,
});

/* CREATE A NEW CLOUDFORMATION STACK FOR CUSTOM RESOURCE DEFINTIONS */
const customResourceStack = backend.createStack('MyCustomResources');

/* DEFINE IAM ROLES FOR REQUIRED BEDROCK PERMISSIONS */
const permissions = new iam.Role(customResourceStack, 'AdminRole', {
  assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
  roleName: 'AdminPermissions',
  description: 'Role for Amazon Bedrock with administrator access',
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonOpenSearchServiceFullAccess'),
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedRockFullAccess'),
  ],
});

/* CREATE AN AWS KMS KEY WITH ENCRYPTION ENABLED */
const myKey = new kms.Key(customResourceStack, 'MyKey', {
  enableKeyRotation: true,
  enabled: true,
  alias: 'amplify-search-tool-key',
});

/* DEFINE AMAZON OPENSEARCH SERVERLESS ACCESS POLICY */
const accessPolicy = new opensearchserverless.CfnAccessPolicy(customResourceStack, 'OpenSearchAccessPolicy', {
  name: 'collection-policy',
  type: 'data',
  description: 'Access policy for collection',
  policy: JSON.stringify([{
    Description: 'Access for test-user',
    Rules: [
      {
        ResourceType: 'index',
        Resource: ['index/*/*'],
        Permission: [
          'aoss:CreateIndex',
          'aoss:DeleteIndex',
          'aoss:UpdateIndex',
          'aoss:DescribeIndex',
          'aoss:ReadDocument',
          'aoss:WriteDocument'
        ]
      },
      {
        ResourceType: 'collection',
        Resource: ['collection/amplify-aoss-collection'],
        Permission: [
          'aoss:CreateCollectionItems',
          'aoss:DeleteCollectionItems',
          'aoss:UpdateCollectionItems',
          'aoss:DescribeCollectionItems'
        ]
      }
    ],
    Principal: [permissions.roleArn, `arn:aws:iam::${customResourceStack.account}:role/Admin`],
  }])
});

/* DEFINE AMAZON OPENSEARCH SECURITY POLICY */
const securityPolicy = new opensearchserverless.CfnSecurityPolicy(customResourceStack, 'OpenSearchSecurityPolicy', {
  description: 'Security policy for my-collection',
  name: 'amplify-security-policy',
  type: 'encryption',
  policy: JSON.stringify({
    Rules: [
      {
        ResourceType: 'collection',
        Resource: ['collection/amplify-aoss-collection'],
      }
    ],
    AWSOwnedKey: true,
  })
});

/* DEFINE AMAZON OPENSEARCH NETWORK ACCESS POLICY */
const networkPolicy = new opensearchserverless.CfnSecurityPolicy(customResourceStack, 'OpenSearchNetworkPolicy', {
  description: 'Network policy for my-collection',
  name: 'amplify-network-policy',
  type: 'network',
  policy: JSON.stringify([{
    Rules: [
      {
        ResourceType: 'collection',
        Resource: ['collection/amplify-aoss-collection'],
      }
    ],
    AllowFromPublic: true,
  }])
});

/* DEFINE AMAZON OPENSEARCH SERVERLESS COLLECTION */
const collection = new opensearchserverless.CfnCollection(customResourceStack, 'OpenSearchCollection', {
  name: 'amplify-aoss-collection',
  type: 'VECTORSEARCH',
  description: 'Collection for amplify search tool',
});

/* CREATE COLLECTION IF REQUIRED RESOURCES EXIST USING 'DependsOn' */
collection.node.addDependency(myKey);
collection.addDependency(accessPolicy);
collection.node.addDependency(securityPolicy);
collection.node.addDependency(networkPolicy);

// /* !! REMOVE COMMENTS ON CODE BELOW FOR SECOND DEPLOYMENT !! */

/* CREATE AN AMAZON BEDROCK KNOWLEDGEBASE */
const knowledgeBase = new bedrock.CfnKnowledgeBase(customResourceStack, 'BedrockKB', {
  knowledgeBaseConfiguration: {
    type: 'VECTOR',
    vectorKnowledgeBaseConfiguration: {
      embeddingModelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0',
    },
  },
  name: 'amplify-search-tool-kb',
  roleArn: permissions.roleArn,
  storageConfiguration: {
    type: 'OPENSEARCH_SERVERLESS',
    opensearchServerlessConfiguration: {
      collectionArn: collection.attrArn,
      vectorIndexName: 'bedrock-knowledge-base-default-index',
      fieldMapping: {
        vectorField: 'bedrock-knowledge-base-default-vector',
        textField: 'AMAZON_BEDROCK_TEXT_CHUNK',
        metadataField: 'AMAZON_BEDROCK_METADATA',
      }
    },
  }
});

/* DEFINE S3 AS DATA SOURCE FOR AMAZON BEDROCK KNOWLEDGBASE */
new bedrock.CfnDataSource(customResourceStack, 'BedrockDataSource', {
  name: 'amplify-search-tool-data-source',
  knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
  dataSourceConfiguration: {
    type: 'S3',
    s3Configuration: {
      bucketArn: backend.storage.resources.bucket.bucketArn,
    },
  },
});

/* ADDING IAM POLICIES TO GENERATE HAIKU LAMBDA FUNCTION */
backend.generateHaikuFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      "bedrock:RetrieveAndGenerate",
      "bedrock:Retrieve",
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
      "kms:GenerateDataKey"
    ],
    resources: [
      myKey.keyArn,
      knowledgeBase.attrKnowledgeBaseArn,
      "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0", "arn:aws:bedrock:*::foundation-model/model-id",
    ],
  })
);

/* DEFINE ENVIRONMENT VARIABLES FOR GENERATE HAIKU LAMBDA FUNCTION */
backend.generateHaikuFunction.addEnvironment("KMS_KEY", myKey.keyArn);
backend.generateHaikuFunction.addEnvironment("KNOWLEDGE_BASE_ID", knowledgeBase.attrKnowledgeBaseId);
backend.generateHaikuFunction.addEnvironment("MODEL_ID", 'anthropic.claude-3-haiku-20240307-v1:0');
backend.generateHaikuFunction.addEnvironment("MODEL_ARN", 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0');

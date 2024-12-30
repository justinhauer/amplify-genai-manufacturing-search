import { defineFunction } from '@aws-amplify/backend';

export const generateHaikuFunction = defineFunction({
    name: 'generate-haiku',
    entry: './handler.ts',
    timeoutSeconds: 60
});

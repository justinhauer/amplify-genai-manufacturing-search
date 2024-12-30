import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { generateHaikuFunction } from "../functions/generateFunction/resource";

const schema = a.schema({
  generateHaiku: a.query()
    .arguments({ prompt: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(generateHaikuFunction)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
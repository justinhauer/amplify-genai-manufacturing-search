import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
    name: "amplify-search-tool-storage",
    access: (allow) => ({
        'public/*': [
            allow.authenticated.to(['read', 'write'])
        ]
    })
});
import type { Schema } from "../../data/resource";

import {
    BedrockAgentRuntimeClient,
    RetrieveAndGenerateCommand,
    RetrieveAndGenerateCommandInput,
    PromptTemplate
} from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient();

export const handler: Schema["generateHaiku"]["functionHandler"] = async (
    event,
) => {
    const prompt = event.arguments.prompt;

    const promptTemplate: PromptTemplate = {
        textPromptTemplate: `
            You are an AWS search assistant that presents results in a clear format. Your response must follow these exact formatting rules:
            
            1. Start with "Search Results for: [query]" on its own line
            2. Skip a line
            3. Add "First Result: [Title]" on its own line
            4. Add a paragraph summary (3-5 sentences) on the next line
            5. Skip a line
            6. Add "Link: [URL]" on its own line
            7. Skip a line
            8. Add "Additional Results:" on its own line
            9. Skip a line
            10. For each additional result:
                - Add "[Title] - [Brief description]" on its own line
                - Add the URL on the next line
                - Skip a line before the next result
            
            CRITICAL: Do not include line numbers, section markers, or "Citations:" in your response.
            
            Here is the search data to use:
            $search_results$
`,
    };

    const input: RetrieveAndGenerateCommandInput = {
        input: {
            text: prompt,
        },

        retrieveAndGenerateConfiguration: {
            type: "KNOWLEDGE_BASE",
            knowledgeBaseConfiguration: {
                knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID!,
                modelArn: process.env.MODEL_ARN!,
                retrievalConfiguration: {
                    vectorSearchConfiguration: {
                        numberOfResults: 10
                    },
                },
                generationConfiguration: {
                    promptTemplate,
                    inferenceConfig: {
                        textInferenceConfig: {
                            temperature: 0.7,
                            maxTokens: 150,
                        },
                    },
                },
            },
        },
        sessionConfiguration: {
            kmsKeyArn: process.env.KMS_KEY!,
        },
    };

    const command = new RetrieveAndGenerateCommand(input);

    const response = await client.send(command);

    const generatedText = response.output?.text || "The query does not match any known results.";

    const citations = response.citations?.map((citation, index) => {
        const location = citation.retrievedReferences?.[0]?.location;
        if (location) {
            const s3Uri = location.s3Location?.uri || "";
            return `${index + 1}. ${s3Uri}`;
        } else {
            return `${index + 1}.`;
        }
    }).join("\n") || "No citations available";

    return `${generatedText}\n\nCitations:\n${citations}`;
};

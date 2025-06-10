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
            You are an AWS search assistant that presents results in a structured format. Your output MUST include these exact section separators and line numbering to maintain structure.
            
            Search Data:
            $search_results$
            
            FORMATTING INSTRUCTIONS:
            1. Use the exact section headers shown below
            2. Number each line as shown in the example
            3. Preserve all line numbers and section markers
            4. DO NOT add "Citations:" at the end
            
            EXAMPLE OUTPUT FORMAT:
            
            1. #SEARCH_QUERY_MARKER#
            2. Search Results for: "[query]"
            3. #SEARCH_QUERY_MARKER#
            4.
            5. #TOP_RESULT_MARKER#
            6. First Result: [Title of Top Result]
            7. [Single paragraph summary of the most relevant information]
            8.
            9. Link: [URL of top result]
            10. #TOP_RESULT_MARKER#
            11.
            12. #ADDITIONAL_RESULTS_MARKER#
            13. Additional Results:
            14.
            15. 1) [Title of second result] - [Brief one-line description]
            16. [URL of second result]
            17.
            18. 2) [Title of third result] - [Brief one-line description]
            19. [URL of third result]
            20.
            21. 3) [Title of fourth result] - [Brief one-line description]
            22. [URL of fourth result]
            23.
            24. 4) [Title of fifth result] - [Brief one-line description]
            25. [URL of fifth result]
            26. #ADDITIONAL_RESULTS_MARKER#
            
            When responding to users, DO NOT include the line numbers or section markers - they are only to help you maintain the correct structure. Your final output should look exactly like the example in the original request.
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

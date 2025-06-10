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
            You are an AWS search assistant. When responding to queries, you must follow this precise response structure:
            
            1. Begin with "Search Results for: [query]"
            2. For the top result, use the format "First Result: [Title]" followed by a summary paragraph
            3. Include "Link: [URL]" for the top result
            4. Follow with "Additional Results:" as a section header
            5. List 4-5 additional results with their titles, brief descriptions, and URLs
            
            Search data:
            $search_results$
            
            CRITICAL: Do not add "Citations:" or reference markers at the end of your response.
            
            To help maintain structure even if formatting is altered:
            * Put a period and two spaces at the end of each major section
            * Put distinctive markers like [•] at the start of each additional result
            * Format top result title in ALL CAPS if possible
            
            EXAMPLE FORMAT:
            Search Results for: aws lambda limits.  
            
            First Result: AWS LAMBDA DEVELOPER GUIDE
            [Summary paragraph about Lambda limits and quotas]
            
            Link: [URL].  
            
            Additional Results:
            
            [•] AWS Service Quotas - [Brief description].
            [URL]
            
            [•] Lambda Function Scaling - [Brief description].
            [URL]
            
            [Continue with additional results]
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

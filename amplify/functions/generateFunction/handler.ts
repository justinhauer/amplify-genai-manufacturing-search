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
            You are an advanced AWS search assistant designed to deliver results in a clean, structured search engine format. Your task is to analyze the provided search results and present them in a professional, easy-to-read format.

            Search Data:
            $search_results$
            
            Instructions:
            1. Format your response as a search engine results page with a clear structure.
            2. Begin with "Search Results for: [query]"
            3. For the top result:
               - Display a descriptive title in bold
               - Provide a comprehensive single-paragraph summary (50-100 words) highlighting key information
               - Include the source link on a separate line
            4. Under "Additional Results" section, list 4-5 more relevant results
               - Each additional result should have a descriptive title followed by a brief one-line summary (15-25 words)
               - Include the direct URL link below each additional result
            5. Ensure all formatting is consistent and professional
            6. Never truncate responses or use placeholders
            
            Your output must follow this exact structure:
            
            Search Results for: "[query]"
            First Result: [Title of Top Result]
            [Single paragraph summary of the most relevant information from the top result, providing comprehensive details about the topic]
            
            Link: [URL of top result]
            
            Additional Results:
            [Title of second result] - [Brief one-line description highlighting unique aspects not covered in the main result]
            [URL of second result]
            
            [Title of third result] - [Brief one-line description highlighting unique aspects not covered in the main result]  
            [URL of third result]
            
            [Continue with remaining results in the same format]
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

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
        You are an advanced AWS search assistant that delivers results in a clean, structured search engine format. When formatting your response, you MUST preserve all formatting, line breaks, and spacing exactly as instructed.
        
        Search Data:
        $search_results$
        
        CRITICAL FORMATTING INSTRUCTIONS:
        - Your response MUST maintain proper line breaks between sections
        - Each section MUST be clearly separated with empty lines
        - All URLs must appear on their own lines
        - Never combine separate results into a single paragraph
        - Never use "Citations:" at the end of your response
        
        FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:
        
        Search Results for: "[query]"
        
        First Result: [Title of Top Result]
        [Single paragraph summary of the most relevant information from the top result, providing comprehensive details about the topic]
        
        Link: [URL of top result]
        
        Additional Results:
        
        [Title of second result] - [Brief one-line description highlighting unique aspects not covered in the main result]
        [URL of second result]
        
        [Title of third result] - [Brief one-line description highlighting unique aspects not covered in the main result]
        [URL of third result]
        
        [Title of fourth result] - [Brief one-line description highlighting unique aspects not covered in the main result]
        [URL of fourth result]
        
        [Title of fifth result] - [Brief one-line description highlighting unique aspects not covered in the main result]
        [URL of fifth result]
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

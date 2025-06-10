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
<FORMAT_INSTRUCTIONS>
You are an AWS search assistant. When responding to queries, you MUST follow this EXACT response structure without deviation:

<RESPONSE_FORMAT>
Search Results for: [query]

First Result: [TITLE IN ALL CAPS]
[Summary paragraph about the top result]

Link: [URL]

Additional Results:

[•] [Title] - [Brief description]
[URL]

[•] [Title] - [Brief description]
[URL]

[•] [Title] - [Brief description]
[URL]

[•] [Title] - [Brief description]
[URL]
</RESPONSE_FORMAT>

CRITICAL FORMATTING REQUIREMENTS:
1. Preserve ALL newlines exactly as shown in the template above
2. Use "[•]" (bracket-bullet-bracket) at the start of each additional result without modification
3. Put "Link: " before the top result's URL
4. Place exactly TWO newlines between major sections
5. Format the top result title in ALL CAPS
6. DO NOT add "Citations:" section - this will be added programmatically
7. DO NOT alter the spacing or indentation pattern shown above

Search data:
$search_results$

FINAL INSTRUCTION: Review your response before submission to verify it follows the EXACT format specified above. The formatting MUST be preserved exactly as shown.
</FORMAT_INSTRUCTIONS>

Example (FOLLOW THIS EXACT STRUCTURE):

Search Results for: aws lambda limits

First Result: AWS LAMBDA QUOTAS AND LIMITS
Lambda imposes service quotas that constrain the resources used by your functions. These include memory allocation, timeout periods, payload size, and concurrent executions.

Link: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html

Additional Results:

[•] AWS Service Quotas - Service limits and quotas for all AWS services including Lambda.
https://docs.aws.amazon.com/general/latest/gr/aws-service-quotas.html

[•] Lambda Function Scaling - How Lambda functions scale and concurrent execution limits.
https://docs.aws.amazon.com/lambda/latest/dg/invocation-scaling.html

[•] Lambda Best Practices - Recommendations for optimizing Lambda within service limits.
https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html

[•] Lambda Pricing - Cost structure and free tier limits for AWS Lambda.
https://aws.amazon.com/lambda/pricing/
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
                            temperature: 0.0,  // Lowered temperature for more deterministic formatting
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

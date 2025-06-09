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
            You are a helpful search assistant that acts as a smart search engine that provides information about AWS Services. Based on the search results:
            $search_results$
            Respond to the specific query, focusing on the relevant information based on the search results. With all responses, generate a brief paragraph summary with a link to the source of the information for the top result. For additional potential results, provide an article title and link.
            Example query:
            - What are some of the features of AWS lambda
            Example for query results:
                Search Results for: "features of aws lambda"
                First Result: AWS Lambda Features - Serverless Computing
                AWS Lambda is a serverless computing service that lets you run code without provisioning or managing servers. Key features include automatic scaling, built-in fault tolerance, pay-per-use pricing model, and support for multiple programming languages including Node.js, Python, Java, .NET, Go, and Ruby.
                
                Link: https://aws.amazon.com/lambda/features/
                
                Additional Results:
                AWS Lambda - Serverless Computing | Amazon Web Services - Overview of Lambda's core functionality, including event-driven execution, integration with over 200 AWS services, and container image support.
                https://aws.amazon.com/lambda/
                
                Lambda function scaling - AWS Lambda Documentation - Detailed explanation of how Lambda automatically scales your applications by running code in response to each trigger, scaling precisely with the size of the workload.
                https://docs.aws.amazon.com/lambda/latest/dg/lambda-scaling.html
                
                AWS Lambda FAQs - Amazon Web Services - Comprehensive FAQ covering Lambda's features, pricing model, security capabilities, and common use cases.
                https://aws.amazon.com/lambda/faqs/
                
                What Is AWS Lambda? - Introduction to Serverless Computing - Beginner-friendly guide explaining Lambda's serverless architecture and key benefits including reduced operational complexity.
                https://aws.amazon.com/lambda/getting-started/
                
                AWS Lambda Pricing - Pay only for what you use - Information on Lambda's pay-per-use pricing model with free tier options and no upfront costs.
                https://aws.amazon.com/lambda/pricing/`,
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

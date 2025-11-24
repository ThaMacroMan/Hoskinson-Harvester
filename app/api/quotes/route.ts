import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { transcript, settings } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    // Default settings
    const quoteSettings = {
      model: settings?.model || "gpt-5-nano",
      numQuotes: settings?.numQuotes || 8,
      pickiness: settings?.pickiness || 5,
    };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Build pickiness instructions based on the pickiness level (1-10)
    const pickinessLevel = quoteSettings.pickiness;
    let pickinessInstructions = "";
    
    if (pickinessLevel >= 8) {
      pickinessInstructions = `Be EXTREMELY selective - only extract quotes that are truly exceptional, profound, or groundbreaking. Reject anything that is merely good or interesting. Only the most powerful, transformative statements should be included.`;
    } else if (pickinessLevel >= 6) {
      pickinessInstructions = `Be highly selective - prioritize exceptional and profound quotes, but also include very strong, memorable statements that are particularly insightful.`;
    } else if (pickinessLevel >= 4) {
      pickinessInstructions = `Be moderately selective - include both exceptional quotes and strong, quotable statements that are meaningful and representative of key themes.`;
    } else {
      pickinessInstructions = `Be less selective - include a good mix of exceptional quotes along with regular but still meaningful, quotable statements that capture the essence of the content.`;
    }

    // Build the API call parameters
    const systemMessage = `You are an expert at identifying powerful, insightful, and memorable quotes from video transcripts. 
Extract ${quoteSettings.numQuotes} quotes that are:
- Thought-provoking or profound
- Memorable and quotable
- Representative of key themes or ideas
- Standalone and meaningful out of context

${pickinessInstructions}

Return a JSON object with a "quotes" array containing the quote strings. Each quote should be a complete, meaningful statement.`;

    const userMessage = `Extract the most powerful quotes from this transcript:\n\n${transcript}`;

    const apiParams: any = {
      model: quoteSettings.model,
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      response_format: { type: "json_object" },
    };

    // Log the request
    console.log("=== OpenAI API Request ===");
    console.log("Model:", quoteSettings.model);
    console.log("System Message:", systemMessage);
    console.log("User Message Length:", userMessage.length, "characters");
    console.log("User Message Preview:", userMessage.substring(0, 200) + "...");
    console.log("Full Request Params:", JSON.stringify(apiParams, null, 2));

    const startTime = Date.now();
    const completion = await openai.chat.completions.create(apiParams);
    const duration = Date.now() - startTime;

    // Log the response
    console.log("=== OpenAI API Response ===");
    console.log("Duration:", duration, "ms");
    console.log("Model Used:", completion.model);
    console.log("Usage:", JSON.stringify(completion.usage, null, 2));
    console.log("Response Content:", completion.choices[0]?.message?.content);
    console.log("===========================");

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const parsed = JSON.parse(response);

    // Handle different possible response formats
    let quotes: string[] = [];
    if (parsed.quotes && Array.isArray(parsed.quotes)) {
      quotes = parsed.quotes;
    } else if (Array.isArray(parsed)) {
      quotes = parsed;
    } else if (typeof parsed === "object") {
      // Try to find any array in the response
      const values = Object.values(parsed);
      const arrayValue = values.find((v) => Array.isArray(v));
      if (arrayValue) {
        quotes = arrayValue as string[];
      }
    }

    return NextResponse.json({
      quotes,
      usage: completion.usage,
      model: completion.model,
      duration,
    });
  } catch (error: any) {
    console.error("Error extracting quotes:", error);
    return NextResponse.json(
      {
        error: "Failed to extract quotes",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

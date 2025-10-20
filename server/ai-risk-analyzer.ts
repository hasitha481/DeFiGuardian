import OpenAI from "openai";
import type { RiskAnalysis } from "@shared/schema";

// Reference to the javascript_openai blueprint integration
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface RiskEventInput {
  eventType: string;
  tokenSymbol?: string;
  spenderAddress?: string;
  amount: string;
  accountAddress: string;
  whitelistedAddresses: string[];
}

export async function analyzeRisk(input: RiskEventInput): Promise<RiskAnalysis> {
  try {
    // Basic rule-based scoring
    let baseScore = 0;
    const recommendations: string[] = [];

    // Check if spender is whitelisted
    if (input.spenderAddress && input.whitelistedAddresses.includes(input.spenderAddress)) {
      return {
        score: 10,
        level: "low",
        reasoning: "This contract is in your whitelist of trusted addresses.",
        recommendations: ["Continue monitoring", "Keep whitelist updated"],
      };
    }

    // High amount check
    const amount = parseFloat(input.amount);
    if (amount > 1000000) {
      baseScore += 40;
      recommendations.push("Very large approval amount detected");
    } else if (amount > 10000) {
      baseScore += 20;
      recommendations.push("Large approval amount");
    }

    // Event type scoring
    if (input.eventType === "approval") {
      baseScore += 30; // Approvals are inherently riskier
      recommendations.push("Monitor approval usage");
    }

    // Unknown spender adds risk
    if (input.spenderAddress && !input.spenderAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      baseScore += 20;
      recommendations.push("Verify spender contract");
    }

    // Use AI for contextual analysis
    const prompt = `Analyze this DeFi transaction for security risks:
    
Event Type: ${input.eventType}
Token: ${input.tokenSymbol || "Unknown"}
Spender: ${input.spenderAddress || "N/A"}
Amount: ${input.amount}

Provide a brief risk assessment (2-3 sentences) explaining potential security concerns and whether this appears to be a legitimate DeFi interaction or potentially malicious.

Respond in JSON format: { "reasoning": string, "additionalRecommendations": string[] }`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a DeFi security expert analyzing blockchain transactions for potential risks. Provide clear, actionable insights.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 512,
    });

    const aiAnalysis = JSON.parse(response.choices[0].message.content || "{}");
    
    // Combine AI analysis with rule-based scoring
    const finalScore = Math.min(100, Math.max(0, baseScore));
    const level: "low" | "medium" | "high" =
      finalScore >= 70 ? "high" : finalScore >= 40 ? "medium" : "low";

    return {
      score: finalScore,
      level,
      reasoning: aiAnalysis.reasoning || "Risk analysis completed",
      recommendations: [
        ...recommendations,
        ...(aiAnalysis.additionalRecommendations || []),
      ],
    };
  } catch (error) {
    console.error("AI risk analysis failed:", error);
    
    // Fallback to rule-based only
    const amount = parseFloat(input.amount);
    let score = 30;
    
    if (amount > 1000000) score = 80;
    else if (amount > 10000) score = 50;
    
    return {
      score,
      level: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
      reasoning: "Automated risk assessment (AI analysis unavailable)",
      recommendations: [
        "Review approval amount",
        "Verify contract legitimacy",
        "Consider setting lower limits",
      ],
    };
  }
}

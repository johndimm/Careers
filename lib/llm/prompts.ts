export const SYSTEM_PROMPT = `You are a knowledgeable career research assistant. You extract structured information about people's professional careers and company histories from web search results. Always respond with valid JSON matching the requested schema. Only include information supported by the provided search results. Do NOT fabricate or hallucinate data. If information is not in the search results, omit that field or use null.`;

export function personPrompt(name: string, searchContext: string, excludeCompanies?: string[]): string {
  const excludeClause = excludeCompanies?.length
    ? `\n\nIMPORTANT: We already know about these companies — do NOT include them again:\n${excludeCompanies.map(n => `- ${n}`).join('\n')}\nFind DIFFERENT companies instead.\n`
    : '';

  return `Here are web search results about "${name}":

---
${searchContext}
---

Based ONLY on the search results above, extract the professional career of "${name}".${excludeClause}

IMPORTANT: Only include positions that "${name}" PERSONALLY held. Do NOT include positions held by other people at the same companies. Each entry must be a role that "${name}" had.

IMPORTANT: If a [Resume] section is present above, treat it as the PRIMARY and most authoritative source. Extract EVERY company and position listed in the resume — do not skip any, even if they appear minor or short-term. Web search results supplement the resume but should not override it.

Return a JSON object with this exact structure:
{
  "name": "Full proper name",
  "summary": "2-3 sentence professional summary",
  "companies": [
    {
      "company_name": "Company Name",
      "position": "Job Title",
      "start_year": 2015,
      "end_year": 2020,
      "projects": ["Notable project 1", "Notable project 2"],
      "coworkers": ["Notable coworker 1", "Notable coworker 2"],
      "reports_to": "Manager name or null",
      "performance_comments": "Notable achievements or null"
    }
  ]
}

Include ALL companies and positions found for "${name}" in the search results, from most recent to oldest. Use null for unknown years. Only include projects, coworkers, reports_to if explicitly mentioned. If a person held multiple positions at the same company, include each position as a separate entry. Return ONLY the JSON object, no other text.`;
}

export function companyPrompt(name: string, searchContext: string, excludeNames?: string[]): string {
  const excludeClause = excludeNames?.length
    ? `\n\nIMPORTANT: We already know about these people — do NOT include them again:\n${excludeNames.map(n => `- ${n}`).join('\n')}\nFind DIFFERENT people instead.\n`
    : '';

  return `Here are web search results about "${name}":

---
${searchContext}
---

Based ONLY on the search results above, extract information about the company "${name}".${excludeClause} Return a JSON object with this exact structure:
{
  "name": "Official Company Name",
  "description": "2-3 sentence company description",
  "products": "Key products and services",
  "history": "Brief company history",
  "notable_people": [
    {
      "person_name": "Person Name",
      "position": "Their role at the company",
      "start_year": 2015,
      "end_year": 2020,
      "projects": ["Notable project 1"],
      "coworkers": ["Notable coworker 1"],
      "reports_to": "Manager name or null"
    }
  ]
}

Include AS MANY people as you can find in the search results — not just executives and founders, but also engineers, designers, product managers, marketers, and any other employees mentioned. Aim for at least 8-10 people if the search results contain them. Use null for unknown years. Return ONLY the JSON object, no other text.`;
}

export function intersectionPrompt(personName: string, companyName: string, searchContext: string): string {
  return `Here are web search results about "${personName}" at "${companyName}":

---
${searchContext}
---

Based ONLY on the search results above, extract people who worked with "${personName}" at "${companyName}". Return a JSON object with this exact structure:
{
  "connections": [
    {
      "person_name": "Person Name",
      "position": "Their role at ${companyName}",
      "start_year": 2015,
      "end_year": 2020,
      "relationship": "How they worked with ${personName}"
    }
  ]
}

Only include people explicitly mentioned in the search results. Use null for unknown years. Return ONLY the JSON object, no other text.`;
}

import { checkQualification, gradeToPoints } from '../utils/helpers.js';

const GRADE_ORDER = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'];

function buildFallbackReasoning({ studentName, studentGrade, programmeName, minQualification, minGradePoints, requirements, qualified, studentPoints, requiredPoints }) {
  const gap = requiredPoints - studentPoints;
  const gradeRank = (g) => GRADE_ORDER.indexOf(g?.trim?.() || '');
  const studentRank = gradeRank(studentGrade);
  const requiredRank = gradeRank(minQualification);

  const lines = [];

  if (qualified) {
    lines.push(
      `${studentName || 'The applicant'} achieved a KCSE mean grade of **${studentGrade}** (${studentPoints} grade points), which meets or exceeds the minimum requirement of **${minQualification}** (${requiredPoints} points) for **${programmeName}**.`
    );
    if (requirements) {
      lines.push(`Programme entry requirements state: "${requirements}". Based on the submitted mean grade, the applicant satisfies the primary academic threshold.`);
    }
    lines.push('Recommendation: Proceed to admission offer — the applicant is academically eligible for this programme.');
  } else {
    lines.push(
      `${studentName || 'The applicant'} achieved a KCSE mean grade of **${studentGrade}** (${studentPoints} grade points), which is **${gap} point${gap !== 1 ? 's' : ''} below** the minimum requirement of **${minQualification}** (${requiredPoints} points) for **${programmeName}**.`
    );
    if (studentRank >= 0 && requiredRank >= 0 && studentRank > requiredRank) {
      const steps = studentRank - requiredRank;
      lines.push(`The applicant's grade is ${steps} tier${steps !== 1 ? 's' : ''} below the required grade on the KCSE scale.`);
    }
    if (requirements) {
      lines.push(`Programme requirements: "${requirements}". The submitted mean grade does not meet this threshold.`);
    }
    lines.push('Recommendation: The applicant does not qualify for this programme. Consider advising them to apply for a programme with lower entry requirements or to improve their grades.');
  }

  return lines.join('\n\n');
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: 'You are an admissions officer at a Kenyan university. Explain qualification decisions clearly and professionally in 2-4 short paragraphs. Reference KCSE grades and programme requirements. Be factual and supportive.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.warn('OpenAI API error:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function generateQualificationReasoning({
  studentName,
  studentGrade,
  programmeName,
  minQualification,
  minGradePoints,
  requirements,
}) {
  const result = checkQualification(studentGrade, minQualification, minGradePoints);

  const prompt = `Analyse this university admission qualification:

Student: ${studentName}
Student KCSE Mean Grade: ${studentGrade} (${result.studentPoints} grade points)
Programme: ${programmeName}
Minimum Required Grade: ${minQualification} (${result.requiredPoints} grade points minimum)
Detailed Requirements: ${requirements || 'Not specified'}
System Decision: ${result.qualified ? 'QUALIFIED' : 'NOT QUALIFIED'}

Explain in plain language why this applicant ${result.qualified ? 'qualifies' : 'does not qualify'}. Include the grade comparison and a brief recommendation for the admissions office.`;

  let reasoning = await callOpenAI(prompt);
  let source = 'openai';

  if (!reasoning) {
    reasoning = buildFallbackReasoning({
      studentName,
      studentGrade,
      programmeName,
      minQualification,
      minGradePoints,
      requirements,
      qualified: result.qualified,
      studentPoints: result.studentPoints,
      requiredPoints: result.requiredPoints,
    });
    source = 'rules';
  }

  return {
    ...result,
    reasoning,
    reasoningSource: source,
  };
}

const GRADE_POINTS = {
  'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8,
  'C+': 7, 'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2, 'E': 1,
};

export function gradeToPoints(grade) {
  if (!grade) return 0;
  const normalized = grade.trim().toUpperCase();
  if (GRADE_POINTS[normalized] !== undefined) return GRADE_POINTS[normalized];
  const meanMatch = normalized.match(/([A-E][+-]?)/);
  if (meanMatch) return GRADE_POINTS[meanMatch[1]] || 0;
  return 0;
}

export function checkQualification(studentGrade, minGrade, minPoints) {
  const points = gradeToPoints(studentGrade);
  const required = minPoints || gradeToPoints(minGrade);
  const qualified = points >= required;
  return {
    qualified,
    studentPoints: points,
    requiredPoints: required,
    message: qualified
      ? 'Student meets the programme requirements.'
      : 'Student does not meet the minimum grade requirement.',
  };
}

export function generateAdmissionNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `ADM/${year}/${random}`;
}

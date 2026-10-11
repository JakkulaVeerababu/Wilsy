/*
 * Pure helpers for the Government Exams browse model.
 *
 * These functions deliberately do not make network requests, inspect the DOM,
 * or decide legal eligibility.  The catalog is a starting-point shortlist and
 * the recruiting authority's live notification remains the source of truth.
 */

const QUALIFICATION_RANKS = Object.freeze({
  '10th': 1,
  '12th': 2,
  'ITI/Diploma': 3,
  Graduate: 4,
  'Post-graduate': 5,
  'B.Tech/Professional': 6
});

const ACADEMIC_LEVELS = Object.freeze({
  '10th': 1,
  '12th': 2,
  Graduate: 3,
  'Post-graduate': 4
});

const QUALIFICATION_KEYS = Object.freeze(['qualification', 'qualificationRank', 'education', 'qualificationLevel']);

const ROUTE_ALIASES = new Map([
  ['engineering', 'engineering'],
  ['technology', 'engineering'],
  ['btech', 'engineering'],
  ['be', 'engineering'],
  ['professional', 'professional'],
  ['law', 'law'],
  ['legal', 'law'],
  ['llb', 'law'],
  ['llm', 'law'],
  ['nursing', 'nursing'],
  ['bscnursing', 'nursing'],
  ['gnm', 'nursing'],
  ['anm', 'nursing'],
  ['teachertraining', 'teacher-training'],
  ['teaching', 'teacher-training'],
  ['bed', 'teacher-training'],
  ['ded', 'teacher-training'],
  ['deled', 'teacher-training'],
  ['dled', 'teacher-training'],
  ['stenography', 'skill-specific'],
  ['shorthand', 'skill-specific'],
  ['postgraduatesubject', 'postgraduate-subject'],
  ['subject', 'subject-specific'],
  ['subjectspecific', 'subject-specific'],
  ['science', 'science'],
  ['agriculture', 'science'],
  ['forestry', 'science'],
  ['technicaltrade', 'technical-trade'],
  ['engineeringscience', 'engineering-or-science'],
  ['engineeringorscience', 'engineering-or-science'],
  ['skillspecific', 'skill-specific'],
  ['iti', 'technical-trade'],
  ['diploma', 'technical-trade'],
  ['trade', 'technical-trade']
]);

const qualificationAliases = new Map([
  ['10th', '10th'],
  ['10', '10th'],
  ['class10', '10th'],
  ['ssc', '10th'],
  ['secondary', '10th'],
  ['matric', '10th'],
  ['12th', '12th'],
  ['12', '12th'],
  ['class12', '12th'],
  ['hsc', '12th'],
  ['highersecondary', '12th'],
  ['10+2', '12th'],
  ['102', '12th'],
  ['10plus2', '12th'],
  ['iti', 'ITI/Diploma'],
  ['diploma', 'ITI/Diploma'],
  ['itidiploma', 'ITI/Diploma'],
  ['technicaldiploma', 'ITI/Diploma'],
  ['graduate', 'Graduate'],
  ['graduation', 'Graduate'],
  ['bachelor', 'Graduate'],
  ['bachelors', 'Graduate'],
  ['degree', 'Graduate'],
  ['ba', 'Graduate'],
  ['bsc', 'Graduate'],
  ['bcom', 'Graduate'],
  ['bca', 'Graduate'],
  ['bed', 'Graduate'],
  ['ded', '12th'],
  ['deled', '12th'],
  ['dled', '12th'],
  ['ma', 'Post-graduate'],
  ['msc', 'Post-graduate'],
  ['mcom', 'Post-graduate'],
  ['mca', 'Post-graduate'],
  ['mba', 'Post-graduate'],
  ['mtech', 'Post-graduate'],
  ['me', 'Post-graduate'],
  ['phd', 'Post-graduate'],
  ['postgraduate', 'Post-graduate'],
  ['postgraduation', 'Post-graduate'],
  ['masters', 'Post-graduate'],
  ['master', 'Post-graduate'],
  ['pg', 'Post-graduate'],
  ['btech', 'B.Tech/Professional'],
  ['b.e.', 'B.Tech/Professional'],
  ['be', 'B.Tech/Professional'],
  ['b.e/b.tech', 'B.Tech/Professional'],
  ['bebtech', 'B.Tech/Professional'],
  ['btechprofessional', 'B.Tech/Professional'],
  ['professional', 'B.Tech/Professional'],
  ['engineering', 'B.Tech/Professional'],
  ['technology', 'B.Tech/Professional'],
  ['law', 'B.Tech/Professional'],
  ['legal', 'B.Tech/Professional'],
  ['llb', 'B.Tech/Professional'],
  ['llm', 'B.Tech/Professional'],
  ['nursing', 'B.Tech/Professional'],
  ['bscnursing', 'B.Tech/Professional'],
  ['gnm', 'B.Tech/Professional'],
  ['anm', 'B.Tech/Professional'],
  ['teachertraining', 'Graduate'],
  ['stenography', '12th'],
  ['shorthand', '12th']
]);

const categoryAliases = new Map([
  ['civilservices', 'Civil Services'],
  ['civilservice', 'Civil Services'],
  ['upsc', 'Civil Services'],
  ['statepsc', 'State PSC'],
  ['psc', 'State PSC'],
  ['appsc', 'State PSC'],
  ['tspsc', 'State PSC'],
  ['tgpsc', 'State PSC'],
  ['staffselection', 'Staff Selection'],
  ['ssc', 'Staff Selection'],
  ['bankingfinance', 'Banking & Finance'],
  ['banking', 'Banking & Finance'],
  ['finance', 'Banking & Finance'],
  ['regulatory', 'Banking & Finance'],
  ['railways', 'Railways'],
  ['railway', 'Railways'],
  ['rrb', 'Railways'],
  ['defence', 'Defence'],
  ['defense', 'Defence'],
  ['armedforces', 'Defence'],
  ['policeuniformed', 'Police & Uniformed'],
  ['police', 'Police & Uniformed'],
  ['uniformed', 'Police & Uniformed'],
  ['teaching', 'Teaching'],
  ['education', 'Teaching'],
  ['engineering', 'Engineering & Science'],
  ['engineeringscience', 'Engineering & Science'],
  ['science', 'Engineering & Science'],
  ['postal', 'Postal'],
  ['post', 'Postal'],
  ['healthcare', 'Healthcare'],
  ['health', 'Healthcare'],
  ['medical', 'Healthcare'],
  ['judiciary', 'Judiciary'],
  ['law', 'Judiciary'],
  ['stateservices', 'State Services']
]);

const competitionOrder = new Map([
  ['moderate', 1],
  ['high', 2],
  ['very high', 3],
  ['extremely high', 4],
  ['varies by cycle', 5]
]);

const text = value => String(value ?? '').trim();
const lower = value => text(value).toLocaleLowerCase();
const compact = value => lower(value).replace(/[\s_.,;:/+&-]+/g, '');

function arrayFrom(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || text(value) === '') return [];
  return [value];
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const parsed = Number(text(value));
  return Number.isFinite(parsed) && text(value) !== '' ? parsed : NaN;
}

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function normaliseRoute(value) {
  const raw = text(value);
  if (!raw) return '';
  const key = compact(raw);
  if (ROUTE_ALIASES.has(key)) return ROUTE_ALIASES.get(key);
  if (/engineering|technology|btech|civil|mechanical|electrical|electronics|computer/.test(key)) return 'engineering';
  if (/law|legal|llb|llm/.test(key)) return 'law';
  if (/nursing|gnm|anm/.test(key)) return 'nursing';
  if (/teacher|bed|deled|ded|dled/.test(key)) return 'teacher-training';
  if (/stenograph|shorthand/.test(key)) return 'skill-specific';
  if (/science|agriculture|forestry/.test(key)) return 'science';
  if (/subject/.test(key)) return 'subject-specific';
  if (/postgraduate|masters|master|pg/.test(key)) return 'postgraduate-subject';
  if (/iti|diploma|trade|technical/.test(key)) return 'technical-trade';
  return '';
}

function routeFromCredential(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const explicit = value.qualificationRoute ?? value.route ?? value.discipline ?? value.stream ?? value.field ?? value.subject;
    const route = normaliseRoute(explicit);
    if (route) return route;
    if (text(explicit)) return 'subject-specific';
    return routeFromCredential(value.qualification ?? value.label ?? value.name);
  }
  const raw = text(value);
  const key = compact(raw);
  // The combined display label is intentionally not treated as an exact branch.
  if (key === 'btechprofessional' || key === 'professional') return '';
  return normaliseRoute(raw);
}

function credentialFrom(value) {
  const qualification = normaliseQualification(value);
  return {
    qualification,
    route: routeFromCredential(value),
    valid: Boolean(QUALIFICATION_RANKS[qualification])
  };
}

function qualificationAnswers(options) {
  const values = [];
  let supplied = false;
  for (const key of QUALIFICATION_KEYS) {
    if (!hasOwn(options, key)) continue;
    supplied = true;
    const value = options[key];
    if (Array.isArray(value)) values.push(...value);
    else values.push(value);
  }
  if (hasOwn(options, 'qualifications')) {
    supplied = true;
    const value = options.qualifications;
    if (Array.isArray(value)) values.push(...value);
    else values.push(value);
  }
  return {supplied, values, credentials: values.map(credentialFrom)};
}

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return {year, month, day};
}

/**
 * Calculate completed years between two strict UTC date-only values.  This is
 * a calculator, not an age-rule decision: it returns null for malformed or
 * impossible dates and when birthDate is after referenceDate.
 */
export function ageOnDate(birthDate, referenceDate) {
  const birth = parseDateOnly(birthDate);
  const reference = parseDateOnly(referenceDate);
  if (!birth || !reference) return null;
  if (birth.year > reference.year || (birth.year === reference.year && (birth.month > reference.month || (birth.month === reference.month && birth.day > reference.day)))) return null;
  let age = reference.year - birth.year;
  if (reference.month < birth.month || (reference.month === birth.month && reference.day < birth.day)) age -= 1;
  return age;
}

/** Return the catalog's canonical qualification label for a common alias. */
export function normaliseQualification(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normaliseQualification(value.qualification ?? value.minimumQualificationRank);
  }
  const rank = numeric(value);
  if (Number.isInteger(rank) && rank >= 1 && rank <= 6) {
    return Object.keys(QUALIFICATION_RANKS).find(label => QUALIFICATION_RANKS[label] === rank) || '';
  }
  const raw = text(value);
  if (!raw) return '';
  const key = compact(raw);
  return qualificationAliases.get(key) || raw;
}

/** Convert a qualification label or rank to the stable 1–6 browse rank. */
export function qualificationRank(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return qualificationRank(value.qualificationRank ?? value.minimumQualificationRank ?? value.qualification);
  }
  const rank = numeric(value);
  if (Number.isInteger(rank) && rank >= 1 && rank <= 6) return rank;
  return QUALIFICATION_RANKS[normaliseQualification(value)] || 0;
}

/** Return the catalog's canonical category label for a common alias. */
export function normaliseCategory(value) {
  const raw = text(value);
  if (!raw) return '';
  return categoryAliases.get(compact(raw)) || raw;
}

function sameText(left, right) {
  return lower(left) === lower(right);
}

function matchesOne(value, wanted, normaliser = value => text(value)) {
  const actual = normaliser(value);
  return arrayFrom(wanted).some(candidate => normaliser(candidate) === actual);
}

function categoriesFor(exam) {
  return [exam?.category, ...arrayFrom(exam?.categories)]
    .map(normaliseCategory)
    .filter(Boolean);
}

function stateMatches(exam, requestedState) {
  const states = arrayFrom(exam?.states).map(text).filter(Boolean);
  const requestedStates = arrayFrom(requestedState).map(text).filter(state => state && !['all', 'any', '0', '*'].includes(lower(state)));
  if (!requestedStates.length) return true;
  return requestedStates.some(requested => {
    if (sameText(requested, 'All India')) return states.some(state => sameText(state, 'All India'));
    return states.some(state => sameText(state, 'All India') || sameText(state, 'State-specific') || sameText(state, requested));
  });
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  const valueText = lower(value);
  if (['true', 'yes', '1'].includes(valueText)) return true;
  if (['false', 'no', '0'].includes(valueText)) return false;
  return undefined;
}

function queryText(exam) {
  return [
    exam?.id,
    exam?.shortName,
    exam?.name,
    exam?.conductingBody,
    exam?.category,
    ...arrayFrom(exam?.categories),
    exam?.qualification,
    exam?.eligibilityText,
    exam?.ageText,
    exam?.careerText,
    exam?.competition,
    ...arrayFrom(exam?.states),
    ...arrayFrom(exam?.stages),
    ...arrayFrom(exam?.syllabus),
    ...arrayFrom(exam?.studyResources)
  ].map(lower).join(' ');
}

function requestedValues(value, normaliser = value => value) {
  return arrayFrom(value)
    .filter(item => !['', 'all', 'any', '0', '*'].includes(lower(item)))
    .map(normaliser)
    .filter(item => item !== '' && item !== undefined && item !== null);
}

/**
 * Filter exam families for browse controls.  Qualification is an exact
 * catalog-label filter; use matchesEligibility for a user's earned level.
 */
export function filterGovernmentExams(exams, filters = {}) {
  const rows = Array.isArray(exams) ? exams : [];
  const options = filters && typeof filters === 'object' ? filters : {};
  const queryWords = lower(options.query).split(/\s+/).filter(Boolean);
  const qualifications = requestedValues(options.qualification, normaliseQualification);
  const categories = requestedValues(options.category, normaliseCategory);
  const tiers = requestedValues(options.tier, numeric).filter(Number.isFinite);
  const powers = requestedValues(options.powerLevel, numeric).filter(Number.isFinite);
  const competitions = requestedValues(options.competition, lower);
  const hasPhysical = options.physical !== undefined && options.physical !== null && text(options.physical) !== '';
  const hasMedical = options.medical !== undefined && options.medical !== null && text(options.medical) !== '';
  const physicalWanted = booleanValue(options.physical);
  const medicalWanted = booleanValue(options.medical);

  return rows.filter(exam => {
    const searchable = queryText(exam);
    if (queryWords.length && !queryWords.every(word => searchable.includes(word))) return false;
    if (qualifications.length && !qualifications.includes(normaliseQualification(exam?.qualification))) return false;
    if (categories.length && !categories.some(category => categoriesFor(exam).some(actual => sameText(actual, category)))) return false;
    if (tiers.length && !tiers.includes(numeric(exam?.prestigeTier))) return false;
    if (powers.length && !powers.includes(numeric(exam?.powerLevel))) return false;
    if (competitions.length && !competitions.includes(lower(exam?.competition))) return false;
    if (options.state && !stateMatches(exam, options.state)) return false;
    if (hasPhysical && physicalWanted !== undefined && Boolean(exam?.physical) !== physicalWanted) return false;
    if (hasMedical && medicalWanted !== undefined && Boolean(exam?.medical) !== medicalWanted) return false;
    return true;
  });
}

function nameComparator(left, right) {
  return text(left?.shortName || left?.name).localeCompare(text(right?.shortName || right?.name), undefined, {sensitivity: 'base'}) || text(left?.id).localeCompare(text(right?.id));
}

function numberOrFallback(value, fallback) {
  const parsed = numeric(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function browseComparator(left, right) {
  return numberOrFallback(left?.prestigeTier, Number.MAX_SAFE_INTEGER) - numberOrFallback(right?.prestigeTier, Number.MAX_SAFE_INTEGER)
    || numberOrFallback(left?.powerLevel, Number.MAX_SAFE_INTEGER) - numberOrFallback(right?.powerLevel, Number.MAX_SAFE_INTEGER)
    || numberOrFallback(competitionOrder.get(lower(left?.competition)), Number.MAX_SAFE_INTEGER) - numberOrFallback(competitionOrder.get(lower(right?.competition)), Number.MAX_SAFE_INTEGER)
    || nameComparator(left, right);
}

/** Sort without changing the caller's array; unknown sort names use browse ranking. */
export function sortGovernmentExams(exams, sort = 'browse') {
  const sorted = Array.isArray(exams) ? [...exams] : [];
  sorted.sort((left, right) => {
    const mode = lower(sort);
    if (['name', 'alphabetical', 'shortname'].includes(mode)) return nameComparator(left, right);
    if (['power', 'power-asc', 'powerlevel', 'power-level', 'authority'].includes(mode)) {
      return numberOrFallback(left?.powerLevel, Number.MAX_SAFE_INTEGER) - numberOrFallback(right?.powerLevel, Number.MAX_SAFE_INTEGER)
        || numberOrFallback(left?.prestigeTier, Number.MAX_SAFE_INTEGER) - numberOrFallback(right?.prestigeTier, Number.MAX_SAFE_INTEGER)
        || nameComparator(left, right);
    }
    if (mode === 'power-desc') {
      return numberOrFallback(right?.powerLevel, -1) - numberOrFallback(left?.powerLevel, -1)
        || numberOrFallback(left?.prestigeTier, Number.MAX_SAFE_INTEGER) - numberOrFallback(right?.prestigeTier, Number.MAX_SAFE_INTEGER)
        || nameComparator(left, right);
    }
    if (['tier', 'prestige', 'prestige-asc', 'prestigetier', 'prestige-tier', 'ranking', 'ranked'].includes(mode)) return browseComparator(left, right);
    if (['qualification', 'qualification-asc', 'qualificationrank', 'qualification-rank', 'minimumqualificationrank'].includes(mode)) {
      return numberOrFallback(left?.minimumQualificationRank ?? left?.qualificationRank, Number.MAX_SAFE_INTEGER)
        - numberOrFallback(right?.minimumQualificationRank ?? right?.qualificationRank, Number.MAX_SAFE_INTEGER)
        || nameComparator(left, right);
    }
    if (['competition', 'competition-asc'].includes(mode)) {
      return numberOrFallback(competitionOrder.get(lower(left?.competition)), Number.MAX_SAFE_INTEGER)
        - numberOrFallback(competitionOrder.get(lower(right?.competition)), Number.MAX_SAFE_INTEGER)
        || browseComparator(left, right);
    }
    return browseComparator(left, right);
  });
  return sorted;
}

/**
 * Convert catalog fields into independent education requirements.  The numeric
 * qualificationRank is intentionally not used for matching: it is a display
 * compatibility field, not a claim that ITI, academic and professional
 * credentials form one ladder.
 */
function examRequirements(exam) {
  const optionLabels = arrayFrom(exam?.qualificationOptions).filter(value => text(value));
  const labels = optionLabels.length ? optionLabels : [exam?.qualification ?? normaliseQualification(exam?.minimumQualificationRank)];
  const routes = arrayFrom(exam?.qualificationRoutes);
  return labels.map((label, index) => ({
    qualification: normaliseQualification(label),
    route: normaliseRoute(routes[index] ?? exam?.qualificationRoute),
    valid: Boolean(QUALIFICATION_RANKS[normaliseQualification(label)])
  }));
}

function academicLevel(value) {
  return ACADEMIC_LEVELS[normaliseQualification(value)] || 0;
}

function baseQualificationSupports(credential, requirement) {
  if (!credential?.valid || !requirement?.valid) return false;
  const required = requirement.qualification;
  const earned = credential.qualification;
  const requiredAcademic = academicLevel(required);
  if (requiredAcademic) {
    if (earned === 'B.Tech/Professional') return requiredAcademic <= ACADEMIC_LEVELS.Graduate;
    const earnedAcademic = academicLevel(earned);
    return earnedAcademic >= requiredAcademic;
  }
  if (required === 'ITI/Diploma') return earned === 'ITI/Diploma';
  if (required === 'B.Tech/Professional') return earned === 'B.Tech/Professional';
  return false;
}

function effectiveRoute(requirement) {
  if (requirement.route) return requirement.route;
  if (requirement.qualification === 'ITI/Diploma') return 'technical-trade';
  if (requirement.qualification === 'B.Tech/Professional') return 'professional';
  return '';
}

function routeStatus(requirement, credential) {
  const route = effectiveRoute(requirement);
  if (!route) return 'match';
  const earned = credential.qualification;
  const actual = credential.route;

  if (route === 'professional') {
    if (earned !== 'B.Tech/Professional') return 'mismatch';
    return actual ? 'match' : 'unknown';
  }
  if (route === 'technical-trade') {
    if (earned !== 'ITI/Diploma') return 'mismatch';
    return actual ? (['technical-trade', 'engineering', 'science'].includes(actual) ? 'match' : 'mismatch') : 'unknown';
  }
  if (route === 'engineering') {
    if (earned !== 'B.Tech/Professional') return 'mismatch';
    return actual ? (actual === 'engineering' ? 'match' : 'mismatch') : 'unknown';
  }
  if (route === 'engineering-or-science') {
    if (!['B.Tech/Professional', 'Post-graduate'].includes(earned)) return 'mismatch';
    return actual ? (['engineering', 'science'].includes(actual) ? 'match' : 'mismatch') : 'unknown';
  }
  if (route === 'law' || route === 'nursing') {
    if (earned !== 'B.Tech/Professional') return 'mismatch';
    return actual ? (actual === route ? 'match' : 'mismatch') : 'unknown';
  }
  if (route === 'teacher-training') {
    return actual ? (actual === route ? 'match' : 'mismatch') : 'unknown';
  }
  if (route === 'postgraduate-subject') {
    if (earned !== 'Post-graduate') return 'mismatch';
    return actual ? (['science', 'subject-specific'].includes(actual) ? 'match' : 'mismatch') : 'unknown';
  }
  if (route === 'subject-specific') {
    return actual ? 'match' : 'unknown';
  }
  if (route === 'skill-specific') {
    return actual ? (actual === route ? 'match' : 'mismatch') : 'unknown';
  }
  return actual ? (actual === route ? 'match' : 'mismatch') : 'unknown';
}

function requirementLabel(requirement) {
  const route = effectiveRoute(requirement);
  const routeText = {
    'technical-trade': 'the exact ITI/diploma trade or discipline',
    professional: 'the exact professional discipline',
    engineering: 'the exact engineering branch',
    'engineering-or-science': 'the exact engineering or science discipline',
    law: 'the exact law qualification and current practice or enrolment rules',
    nursing: 'the exact nursing qualification and registration',
    'teacher-training': 'the required teacher-training qualification',
    'postgraduate-subject': 'the required postgraduate subject',
    'subject-specific': 'the notice-specified subject',
    'skill-specific': 'the notice-specified skill',
    '': 'the notice-specified qualification'
  }[route] || 'the notice-specified qualification';
  return `${requirement.qualification} with ${routeText}`;
}

function qualificationFit(exam, credentials) {
  const requirements = examRequirements(exam);
  if (!requirements.length || requirements.some(requirement => !requirement.valid)) {
    return {status: 'invalid', reason: 'This catalog record has no valid qualification requirement.'};
  }
  let hadBroadMatch = false;
  let hadUnknownRoute = false;
  let hadRouteMismatch = false;
  for (const requirement of requirements) {
    for (const credential of credentials) {
      if (!baseQualificationSupports(credential, requirement)) continue;
      hadBroadMatch = true;
      const route = routeStatus(requirement, credential);
      if (route === 'match' && !effectiveRoute(requirement)) return {status: 'potential'};
      if (route === 'match' || route === 'unknown') {
        hadUnknownRoute = true;
        continue;
      }
      hadRouteMismatch = true;
    }
  }
  if (hadUnknownRoute) {
    return {status: 'review', reason: `Broad education matches, but ${requirementLabel(requirements[0])} must be checked in the official notification; this is never a legal eligibility decision.`};
  }
  if (hadBroadMatch && hadRouteMismatch) {
    return {status: 'unlikely', reason: 'The supplied qualification does not show the exact discipline or professional route required by the overview.'};
  }
  if (!hadBroadMatch) {
    return {status: 'unlikely', reason: 'The supplied education branch does not meet the overview requirement; academic, ITI/diploma and professional routes are kept independent.'};
  }
  return {status: 'review', reason: 'The exact qualification route remains notice-specific.'};
}

function parseAgeAnswer(options) {
  const hasAge = hasOwn(options, 'age') || hasOwn(options, 'ageYears');
  const hasBirthDate = hasOwn(options, 'birthDate') || hasOwn(options, 'referenceDate');
  if (hasBirthDate) {
    if (!hasOwn(options, 'birthDate') || !hasOwn(options, 'referenceDate')) return {status: 'invalid', reason: 'birthDate and referenceDate must be supplied together as YYYY-MM-DD values.'};
    const age = ageOnDate(options.birthDate, options.referenceDate);
    if (age === null) return {status: 'invalid', reason: 'Birth date or reference date is malformed, impossible, or after the reference cutoff.'};
    return {status: 'valid', age};
  }
  if (!hasAge) return {status: 'missing'};
  const value = options.age ?? options.ageYears;
  if (typeof value === 'boolean' || (typeof value !== 'number' && typeof value !== 'string') || text(value) === '') return {status: 'invalid', reason: 'Age must be a finite number from 0 through 100.'};
  const age = Number(value);
  if (!Number.isFinite(age) || age < 0 || age > 100) return {status: 'invalid', reason: 'Age must be a finite number from 0 through 100.'};
  return {status: 'valid', age};
}

function categoryTokens(options) {
  return arrayFrom(options.category ?? options.categories).map(compact).filter(Boolean);
}

function reservedCategory(options) {
  return categoryTokens(options).some(value => ['obc', 'sc', 'st', 'pwbd', 'pwd', 'exservicemen', 'exserviceman'].includes(value));
}

function statusPriority(status) {
  return {potential: 0, review: 1, unlikely: 2, invalid: 3}[status] ?? 3;
}

function addReason(state, status, reason) {
  if (reason && !state.reasons.includes(reason)) state.reasons.push(reason);
  if (statusPriority(status) > statusPriority(state.status)) state.status = status;
}

/**
 * Conservative overview assessment.  It is intentionally not a legal
 * eligibility decision: no reservation, domicile, attempt, experience,
 * subject, medical, physical or notice-specific relaxation is adjudicated.
 * A supplied state is only a target-recruitment browse preference, never a
 * domicile test.  `potential` means broad signals align; `review` means an
 * omitted/approximate/discipline-specific condition needs the live notice.
 */
export function assessEligibility(exam, answers = {}) {
  const state = {status: 'potential', reasons: []};
  if (!exam || typeof exam !== 'object') return {status: 'invalid', reasons: ['An exam record is required.']};
  const options = answers && typeof answers === 'object' ? answers : {};
  const qualifications = qualificationAnswers(options);
  if (!qualifications.supplied) {
    addReason(state, 'review', 'Qualification was not supplied; this browse result cannot be treated as a legal eligibility decision.');
  } else if (!qualifications.credentials.length || qualifications.credentials.some(credential => !credential.valid)) {
    addReason(state, 'invalid', 'Qualification is missing or not one of the supported education labels.');
  } else {
    const fit = qualificationFit(exam, qualifications.credentials);
    addReason(state, fit.status, fit.reason);
  }

  const age = parseAgeAnswer(options);
  if (age.status === 'invalid') addReason(state, 'invalid', age.reason);
  if (age.status === 'missing') addReason(state, 'review', 'Age was not supplied; use the official notice reference date before applying.');
  if (age.status === 'valid') {
    const ageMax = numeric(exam.ageMax);
    const ageMin = numeric(exam.ageMin);
    if (Number.isFinite(ageMax) && age.age > ageMax) {
      addReason(state, 'review', reservedCategory(options)
        ? 'Age is above the approximate general baseline; reservation or special-category relaxation may apply, so the official notice must decide.'
        : 'Age is above the approximate baseline in this overview; the official notification, including any General/EWS rule, must decide.');
    }
    if (Number.isFinite(ageMin) && age.age < ageMin) addReason(state, 'review', 'Age is below an approximate baseline; the current notification must decide the applicable age rule.');
    if (!Number.isFinite(ageMax) && !Number.isFinite(ageMin)) addReason(state, 'review', 'The current notice-specific age limits were not verified for this overview.');
  }

  if (exam.verificationStatus === 'overview-only' || exam.lastVerified === null || exam.lastVerified === undefined) {
    addReason(state, 'review', 'This is an overview-only family record; no current eligibility notification was verified.');
  }
  return {status: state.status, reasons: state.reasons};
}

/**
 * Boolean compatibility wrapper.  It allows only potential/review shortlist
 * results and rejects invalid or unlikely inputs.  It never makes a legal
 * eligibility determination.
 */
export function matchesEligibility(exam, answers = {}) {
  const assessment = assessEligibility(exam, answers);
  return assessment.status === 'potential' || assessment.status === 'review';
}

/** Return stable, first-seen unique values from a flat or selected object list. */
export function uniqueValues(values, selector) {
  const source = Array.isArray(values) ? values : [];
  const result = [];
  const seen = new Set();
  const add = value => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (value === undefined || value === null || text(value) === '') return;
    const key = typeof value === 'string' ? value : JSON.stringify(value);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  };
  source.forEach(item => add(typeof selector === 'function' ? selector(item) : selector ? item?.[selector] : item));
  return result;
}

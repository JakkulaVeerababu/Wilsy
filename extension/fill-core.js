// Which profile detail belongs in a form field, decided from the field's own label, name, id, placeholder and
// autocomplete hint. A classic script (no import/export) so Chrome can inject it; it sets globalThis.WilsyFill.
// Ideas from applyai and JobNavigator (both MIT); no code copied.
(function (root) {
  const SKIP_TYPES = new Set(['hidden', 'password', 'file', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image', 'range', 'color', 'date', 'month', 'week', 'time', 'datetime-local']);
  // A name field that is about someone or something else.
  const NOT_ME = /company|employer|organi[sz]ation|school|university|college|institution|referr|emergency|manager|recruiter|reference|hiring|pronoun|preferred name|nick ?name|legal guardian|spouse|father|mother/;

  const AUTOCOMPLETE = {
    'given-name': 'firstName', 'family-name': 'lastName', name: 'fullName', email: 'email', tel: 'phone', 'tel-national': 'phone',
    'address-level2': 'location', organization: 'currentCompany', url: 'website',
  };

  /** The profile key for a field, or null to leave it alone. `field` = {type, label, name, id, placeholder, autocomplete}. */
  function pickField(field) {
    const type = String(field.type || 'text').toLowerCase();
    if (SKIP_TYPES.has(type)) return null;
    const auto = String(field.autocomplete || '').toLowerCase().split(/\s+/).pop();
    if (AUTOCOMPLETE[auto]) return AUTOCOMPLETE[auto];
    const text = [field.label, field.name, field.id, field.placeholder].filter(Boolean).join(' ').toLowerCase()
      .replace(/[_\-[\].]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    if (!text || /captcha|password|otp|verification code|salary|ctc|notice|visa|sponsor|gender|race|ethnic|veteran|disab|date of birth|\bdob\b|age\b|cover letter|why|describe|tell us/.test(text)) return null;
    if (type === 'email' || /e ?mail/.test(text)) return 'email';
    if (type === 'tel' || /phone|mobile|contact number|whats ?app/.test(text)) return 'phone';
    if (/linked ?in/.test(text)) return 'linkedin';
    if (/git ?hub/.test(text)) return 'github';
    if (/portfolio|personal (web)?site|website|blog/.test(text)) return 'website';
    if (/current (company|employer)|present (company|employer)/.test(text)) return 'currentCompany';
    if (NOT_ME.test(text)) return null;
    if (/first name|given name|\bfname\b|first$/.test(text)) return 'firstName';
    if (/last name|surname|family name|\blname\b|last$/.test(text)) return 'lastName';
    if (/full name|^name$|^your name$|candidate name|applicant name|^name \*?$/.test(text)) return 'fullName';
    if (/current (location|city)|^location$|^city$|where are you (based|located)|location \(city\)/.test(text)) return 'location';
    return null;
  }

  /** The value to put in, from the saved profile; fullName is built from the first and last names. */
  function valueFor(key, profile) {
    const p = profile || {};
    if (key === 'fullName') return [p.firstName, p.lastName].map(v => String(v || '').trim()).filter(Boolean).join(' ');
    return String(p[key] || '').trim();
  }

  root.WilsyFill = {pickField, valueFor};
})(globalThis);
